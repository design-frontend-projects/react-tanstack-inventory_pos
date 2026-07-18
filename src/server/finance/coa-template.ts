// Default chart-of-accounts template applied by initializeTenantFinance().
// Pure data: account type codes reference the seeded fin_account_types rows;
// parentCode builds the hierarchy; settingsRole wires an account into the
// matching fin_settings default column at bootstrap.

export interface CoaTemplateEntry {
  code: string
  name: string
  nameAr: string
  accountTypeCode: string
  parentCode?: string
  isControlAccount?: boolean
  controlDomain?: string
  allowManualJournal?: boolean
  settingsRole?:
    | 'retainedEarningsAccountId'
    | 'fxRealizedGainAccountId'
    | 'fxRealizedLossAccountId'
    | 'fxUnrealizedGainAccountId'
    | 'fxUnrealizedLossAccountId'
    | 'roundingAccountId'
    | 'suspenseAccountId'
    | 'defaultArControlAccountId'
    | 'defaultApControlAccountId'
    | 'grniAccountId'
    | 'inventoryAccountId'
    | 'cogsAccountId'
    | 'salesRevenueAccountId'
    | 'salesDiscountAccountId'
    | 'bankClearingAccountId'
    | 'writeOffAccountId'
}

export const DEFAULT_COA_TEMPLATE: ReadonlyArray<CoaTemplateEntry> = [
  // 1xxx — Assets
  {
    code: '1000',
    name: 'Assets',
    nameAr: 'الأصول',
    accountTypeCode: 'other_asset',
    allowManualJournal: false,
  },
  {
    code: '1100',
    name: 'Cash & Cash Equivalents',
    nameAr: 'النقدية وما في حكمها',
    accountTypeCode: 'cash',
    parentCode: '1000',
    allowManualJournal: false,
  },
  {
    code: '1110',
    name: 'Main Cashbox',
    nameAr: 'الصندوق الرئيسي',
    accountTypeCode: 'cash',
    parentCode: '1100',
  },
  {
    code: '1120',
    name: 'Bank Accounts',
    nameAr: 'الحسابات البنكية',
    accountTypeCode: 'bank',
    parentCode: '1100',
  },
  {
    code: '1130',
    name: 'Bank Clearing',
    nameAr: 'حساب تسوية بنكية وسيط',
    accountTypeCode: 'bank',
    parentCode: '1100',
    settingsRole: 'bankClearingAccountId',
  },
  {
    code: '1200',
    name: 'Accounts Receivable',
    nameAr: 'ذمم العملاء',
    accountTypeCode: 'ar_control',
    parentCode: '1000',
    isControlAccount: true,
    controlDomain: 'ar',
    allowManualJournal: false,
    settingsRole: 'defaultArControlAccountId',
  },
  {
    code: '1300',
    name: 'Inventory',
    nameAr: 'المخزون',
    accountTypeCode: 'inventory',
    parentCode: '1000',
    isControlAccount: true,
    controlDomain: 'inventory',
    allowManualJournal: false,
    settingsRole: 'inventoryAccountId',
  },
  {
    code: '1400',
    name: 'Prepaid Expenses',
    nameAr: 'مصروفات مدفوعة مقدماً',
    accountTypeCode: 'prepaid_expense',
    parentCode: '1000',
  },
  {
    code: '1500',
    name: 'Fixed Assets',
    nameAr: 'الأصول الثابتة',
    accountTypeCode: 'fixed_asset',
    parentCode: '1000',
  },
  {
    code: '1590',
    name: 'Accumulated Depreciation',
    nameAr: 'مجمع الإهلاك',
    accountTypeCode: 'accumulated_depreciation',
    parentCode: '1000',
  },
  {
    code: '1900',
    name: 'Suspense',
    nameAr: 'حساب معلق',
    accountTypeCode: 'other_asset',
    parentCode: '1000',
    settingsRole: 'suspenseAccountId',
  },

  // 2xxx — Liabilities
  {
    code: '2000',
    name: 'Liabilities',
    nameAr: 'الالتزامات',
    accountTypeCode: 'accrued_liability',
    allowManualJournal: false,
  },
  {
    code: '2100',
    name: 'Accounts Payable',
    nameAr: 'ذمم الموردين',
    accountTypeCode: 'ap_control',
    parentCode: '2000',
    isControlAccount: true,
    controlDomain: 'ap',
    allowManualJournal: false,
    settingsRole: 'defaultApControlAccountId',
  },
  {
    code: '2150',
    name: 'Goods Received Not Invoiced',
    nameAr: 'بضاعة مستلمة لم تُفوتر',
    accountTypeCode: 'grni',
    parentCode: '2000',
    isControlAccount: true,
    controlDomain: 'ap',
    allowManualJournal: false,
    settingsRole: 'grniAccountId',
  },
  {
    code: '2200',
    name: 'Tax Payable',
    nameAr: 'ضرائب مستحقة',
    accountTypeCode: 'tax_payable',
    parentCode: '2000',
    isControlAccount: true,
    controlDomain: 'tax',
    allowManualJournal: false,
  },
  {
    code: '2300',
    name: 'Accrued Liabilities',
    nameAr: 'التزامات مستحقة',
    accountTypeCode: 'accrued_liability',
    parentCode: '2000',
  },
  {
    code: '2400',
    name: 'Gift Card Liability',
    nameAr: 'التزامات بطاقات الهدايا',
    accountTypeCode: 'gift_card_liability',
    parentCode: '2000',
  },
  {
    code: '2450',
    name: 'Loyalty Liability',
    nameAr: 'التزامات نقاط الولاء',
    accountTypeCode: 'loyalty_liability',
    parentCode: '2000',
  },
  {
    code: '2500',
    name: 'Tips Payable',
    nameAr: 'إكراميات مستحقة',
    accountTypeCode: 'accrued_liability',
    parentCode: '2000',
  },

  // 3xxx — Equity
  {
    code: '3000',
    name: 'Equity',
    nameAr: 'حقوق الملكية',
    accountTypeCode: 'capital',
    allowManualJournal: false,
  },
  {
    code: '3100',
    name: 'Capital',
    nameAr: 'رأس المال',
    accountTypeCode: 'capital',
    parentCode: '3000',
  },
  {
    code: '3200',
    name: 'Retained Earnings',
    nameAr: 'الأرباح المحتجزة',
    accountTypeCode: 'retained_earnings',
    parentCode: '3000',
    allowManualJournal: false,
    settingsRole: 'retainedEarningsAccountId',
  },

  // 4xxx — Revenue
  {
    code: '4000',
    name: 'Revenue',
    nameAr: 'الإيرادات',
    accountTypeCode: 'sales_revenue',
    allowManualJournal: false,
  },
  {
    code: '4100',
    name: 'Sales Revenue',
    nameAr: 'إيرادات المبيعات',
    accountTypeCode: 'sales_revenue',
    parentCode: '4000',
    settingsRole: 'salesRevenueAccountId',
  },
  {
    code: '4200',
    name: 'Service Revenue',
    nameAr: 'إيرادات الخدمات',
    accountTypeCode: 'service_revenue',
    parentCode: '4000',
  },
  {
    code: '4300',
    name: 'Sales Returns',
    nameAr: 'مردودات المبيعات',
    accountTypeCode: 'sales_returns',
    parentCode: '4000',
  },
  {
    code: '4800',
    name: 'Other Income',
    nameAr: 'إيرادات أخرى',
    accountTypeCode: 'other_income',
    parentCode: '4000',
  },
  {
    code: '4900',
    name: 'Realized FX Gain',
    nameAr: 'أرباح فروق عملة محققة',
    accountTypeCode: 'fx_gain',
    parentCode: '4000',
    settingsRole: 'fxRealizedGainAccountId',
  },
  {
    code: '4910',
    name: 'Unrealized FX Gain',
    nameAr: 'أرباح فروق عملة غير محققة',
    accountTypeCode: 'fx_gain',
    parentCode: '4000',
    settingsRole: 'fxUnrealizedGainAccountId',
  },

  // 5xxx — Expenses
  {
    code: '5000',
    name: 'Expenses',
    nameAr: 'المصروفات',
    accountTypeCode: 'operating_expense',
    allowManualJournal: false,
  },
  {
    code: '5100',
    name: 'Cost of Goods Sold',
    nameAr: 'تكلفة البضاعة المباعة',
    accountTypeCode: 'cogs',
    parentCode: '5000',
    settingsRole: 'cogsAccountId',
  },
  {
    code: '5200',
    name: 'Operating Expenses',
    nameAr: 'مصروفات تشغيلية',
    accountTypeCode: 'operating_expense',
    parentCode: '5000',
  },
  {
    code: '5300',
    name: 'Payroll Expenses',
    nameAr: 'مصروفات الرواتب',
    accountTypeCode: 'payroll_expense',
    parentCode: '5000',
  },
  {
    code: '5400',
    name: 'Depreciation Expense',
    nameAr: 'مصروف الإهلاك',
    accountTypeCode: 'depreciation_expense',
    parentCode: '5000',
  },
  {
    code: '5500',
    name: 'Sales Discounts',
    nameAr: 'خصومات المبيعات',
    accountTypeCode: 'sales_discount',
    parentCode: '5000',
    settingsRole: 'salesDiscountAccountId',
  },
  {
    code: '5600',
    name: 'Bank Charges',
    nameAr: 'مصروفات بنكية',
    accountTypeCode: 'bank_charges',
    parentCode: '5000',
  },
  {
    code: '5700',
    name: 'Write-offs',
    nameAr: 'إعدامات وشطب',
    accountTypeCode: 'write_off',
    parentCode: '5000',
    settingsRole: 'writeOffAccountId',
  },
  {
    code: '5800',
    name: 'Rounding Differences',
    nameAr: 'فروق تقريب',
    accountTypeCode: 'operating_expense',
    parentCode: '5000',
    settingsRole: 'roundingAccountId',
  },
  {
    code: '5900',
    name: 'Realized FX Loss',
    nameAr: 'خسائر فروق عملة محققة',
    accountTypeCode: 'fx_loss',
    parentCode: '5000',
    settingsRole: 'fxRealizedLossAccountId',
  },
  {
    code: '5910',
    name: 'Unrealized FX Loss',
    nameAr: 'خسائر فروق عملة غير محققة',
    accountTypeCode: 'fx_loss',
    parentCode: '5000',
    settingsRole: 'fxUnrealizedLossAccountId',
  },
] as const

// Pure integrity checks used by both bootstrap and the unit tests.
export function validateCoaTemplate(
  template: ReadonlyArray<CoaTemplateEntry>,
): void {
  const codes = new Set<string>()

  for (const entry of template) {
    if (codes.has(entry.code)) {
      throw new Error(`COA template: duplicate code ${entry.code}`)
    }

    codes.add(entry.code)
  }

  for (const entry of template) {
    if (entry.parentCode && !codes.has(entry.parentCode)) {
      throw new Error(
        `COA template: ${entry.code} references missing parent ${entry.parentCode}`,
      )
    }
  }
}

export function templateLevel(
  entry: CoaTemplateEntry,
  byCode: Map<string, CoaTemplateEntry>,
): number {
  let level = 1
  let current = entry

  while (current.parentCode) {
    const parent = byCode.get(current.parentCode)

    if (!parent) {
      break
    }

    level += 1
    current = parent
  }

  return level
}

export function templatePath(
  entry: CoaTemplateEntry,
  byCode: Map<string, CoaTemplateEntry>,
): string {
  const segments = [entry.code]
  let current = entry

  while (current.parentCode) {
    const parent = byCode.get(current.parentCode)

    if (!parent) {
      break
    }

    segments.unshift(parent.code)
    current = parent
  }

  return segments.join('/')
}
