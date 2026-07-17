-- Spec 005 follow-up: settle the totals semantics for pod_ documents.
--
-- Convention (used by the Phase-2 sourcing services and later AP phases):
--   item.net_amount   = qty * unit_price - discount_amount   (net of discount, excl. tax)
--   header.subtotal   = SUM(item.net_amount)
--   header.discount_total = SUM(item.discount_amount)        (informational)
--   header.grand_total    = subtotal + tax_total + charges   (discount already inside subtotal)
--
-- The v1 trigger bodies subtracted discount_total from grand_total, which would
-- double-count the discount under this convention. CREATE OR REPLACE is idempotent.

CREATE OR REPLACE FUNCTION pod_recompute_invoice_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_invoice UUID := COALESCE(NEW.invoice_id, OLD.invoice_id);
BEGIN
  UPDATE "pod_supplier_invoices" inv
  SET "subtotal" = agg.subtotal,
      "tax_total" = agg.tax_total,
      "discount_total" = agg.discount_total,
      "grand_total" = agg.subtotal + agg.tax_total + inv."freight_amount" - inv."retention_amount" - inv."withholding_tax_amount",
      "outstanding_amount" = (agg.subtotal + agg.tax_total + inv."freight_amount" - inv."retention_amount" - inv."withholding_tax_amount") - inv."paid_amount"
  FROM (
    SELECT COALESCE(SUM("net_amount"), 0) AS subtotal,
           COALESCE(SUM("tax_amount"), 0) AS tax_total,
           COALESCE(SUM("discount_amount"), 0) AS discount_total
    FROM "pod_supplier_invoice_items" WHERE "invoice_id" = v_invoice
  ) agg
  WHERE inv."id" = v_invoice;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION pod_recompute_quotation_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_q UUID := COALESCE(NEW.quotation_id, OLD.quotation_id);
BEGIN
  UPDATE "pod_supplier_quotations" q
  SET "subtotal" = agg.subtotal,
      "tax_total" = agg.tax_total,
      "discount_total" = agg.discount_total,
      "grand_total" = agg.subtotal + agg.tax_total + q."freight_amount" + q."insurance_amount"
  FROM (
    SELECT COALESCE(SUM("net_amount"), 0) AS subtotal,
           COALESCE(SUM("tax_amount"), 0) AS tax_total,
           COALESCE(SUM("discount_amount"), 0) AS discount_total
    FROM "pod_supplier_quotation_items" WHERE "quotation_id" = v_q
  ) agg
  WHERE q."id" = v_q;
  RETURN NULL;
END;
$$;
