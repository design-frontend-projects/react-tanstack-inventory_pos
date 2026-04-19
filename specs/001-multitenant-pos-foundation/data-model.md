# Data Model: Multitenant Inventory and POS Foundation

## 1. Tenant

**Purpose**: Represents a business workspace with isolated operational data and configuration.

**Core Fields**

- `id`
- `slug`
- `name`
- `status` (`active`, `suspended`, `archived`)
- `defaultLocale`
- `defaultThemeMode`
- `currencyCode`
- `timezone`
- `createdAt`
- `updatedAt`

**Relationships**

- One tenant has many memberships.
- One tenant has many outlets.
- One tenant has many catalog items.
- One tenant has many stock records.
- One tenant has many POS orders.
- One tenant has many notification events.

**Validation Rules**

- `slug` must be unique.
- `name`, `currencyCode`, and `timezone` are required.
- `status` must default to `active` at creation.

## 2. User Profile

**Purpose**: Stores business-facing profile data for an authenticated user.

**Core Fields**

- `id` (aligned to external auth user identifier)
- `email`
- `displayName`
- `phone`
- `status` (`active`, `invited`, `disabled`)
- `lastSeenAt`
- `createdAt`
- `updatedAt`

**Relationships**

- One user profile has many memberships.
- One user profile has many POS orders as cashier or actor.
- One user profile has many preference profiles.
- One user profile has many notification subscriptions.

**Validation Rules**

- `email` must be unique and normalized.
- `status` is required.

## 3. Tenant Membership

**Purpose**: Associates a user with a tenant and role-specific permissions.

**Core Fields**

- `id`
- `tenantId`
- `userId`
- `role` (`owner`, `admin`, `manager`, `cashier`, `staff`)
- `defaultOutletId` (nullable)
- `status` (`active`, `pending`, `suspended`, `revoked`)
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to one tenant.
- Belongs to one user profile.
- May reference one default outlet.

**Validation Rules**

- Each user can hold only one active membership record per tenant-role combination.
- `defaultOutletId` must belong to the same tenant when present.

**State Transitions**

- `pending -> active`
- `active -> suspended`
- `active -> revoked`
- `suspended -> active`

## 4. Outlet

**Purpose**: Represents a store, branch, or restaurant location where stock and sales are managed.

**Core Fields**

- `id`
- `tenantId`
- `code`
- `name`
- `phone`
- `addressLine1`
- `addressLine2`
- `city`
- `stateProvince`
- `postalCode`
- `countryCode`
- `latitude`
- `longitude`
- `timezone`
- `status` (`active`, `inactive`, `archived`)
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to one tenant.
- Has many stock records.
- Has many POS orders.
- Has many memberships as default outlet references.

**Validation Rules**

- `code` must be unique within a tenant.
- `name`, `addressLine1`, `city`, `countryCode`, and `timezone` are required for active outlets.
- Latitude and longitude must both be present or both absent.

## 5. Catalog Item

**Purpose**: Represents a sellable or trackable item used in inventory or restaurant workflows.

**Core Fields**

- `id`
- `tenantId`
- `sku`
- `name`
- `description`
- `category`
- `itemType` (`inventory`, `menu`, `hybrid`)
- `unitOfMeasure`
- `salePrice`
- `costPrice`
- `taxMode`
- `status` (`active`, `inactive`, `archived`)
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to one tenant.
- Has many stock records.
- Has many stock movements.
- Has many POS order lines.

**Validation Rules**

- `sku` must be unique within a tenant.
- `name`, `itemType`, `unitOfMeasure`, and `salePrice` are required.
- Prices and quantities must be non-negative.

## 6. Stock Record

**Purpose**: Stores the outlet-level stock state for a catalog item.

**Core Fields**

- `id`
- `tenantId`
- `outletId`
- `catalogItemId`
- `onHandQuantity`
- `reservedQuantity`
- `reorderThreshold`
- `availabilityStatus` (`in_stock`, `low_stock`, `out_of_stock`)
- `updatedAt`

**Relationships**

- Belongs to one tenant.
- Belongs to one outlet.
- Belongs to one catalog item.
- Has many stock movements.

**Validation Rules**

- Each outlet-item pair must be unique within a tenant.
- `reservedQuantity` cannot exceed `onHandQuantity`.
- `reorderThreshold` cannot be negative.

**Derived Rules**

- `availabilityStatus` becomes `out_of_stock` when `onHandQuantity <= 0`.
- `availabilityStatus` becomes `low_stock` when `onHandQuantity > 0` and `onHandQuantity <= reorderThreshold`.

## 7. Stock Movement

**Purpose**: Captures stock adjustments caused by POS activity, manual corrections, or replenishment.

**Core Fields**

- `id`
- `tenantId`
- `outletId`
- `catalogItemId`
- `movementType` (`sale`, `restock`, `adjustment`, `void`, `transfer`)
- `reason`
- `quantityDelta`
- `sourceEntityType`
- `sourceEntityId`
- `performedByUserId`
- `occurredAt`

**Relationships**

- Belongs to one stock record context through tenant, outlet, and item.
- May reference one POS order or another source entity.

**Validation Rules**

- `quantityDelta` cannot be zero.
- Sale movements must use a negative quantity delta.

## 8. POS Order

**Purpose**: Represents a single point-of-sale transaction.

**Core Fields**

- `id`
- `tenantId`
- `outletId`
- `orderNumber`
- `orderType` (`counter`, `dine_in`, `takeaway`, `delivery`)
- `status` (`draft`, `open`, `completed`, `cancelled`, `refunded`)
- `currencyCode`
- `subtotalAmount`
- `taxAmount`
- `discountAmount`
- `totalAmount`
- `notes`
- `cashierUserId`
- `openedAt`
- `completedAt`
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to one tenant.
- Belongs to one outlet.
- Belongs to one cashier user.
- Has many POS order lines.
- May trigger one or more stock movements.
- May trigger notification events.

**Validation Rules**

- `orderNumber` must be unique within a tenant.
- Monetary totals must be non-negative.
- `completedAt` is required when status is `completed`.

**State Transitions**

- `draft -> open`
- `open -> completed`
- `open -> cancelled`
- `completed -> refunded`

## 9. POS Order Line

**Purpose**: Represents a catalog item snapshot within a POS order.

**Core Fields**

- `id`
- `posOrderId`
- `catalogItemId`
- `itemNameSnapshot`
- `skuSnapshot`
- `quantity`
- `unitPrice`
- `discountAmount`
- `lineTotalAmount`
- `notes`

**Relationships**

- Belongs to one POS order.
- References one catalog item.

**Validation Rules**

- `quantity` must be greater than zero.
- `unitPrice` must be non-negative.
- `lineTotalAmount` must equal the computed amount after discounts.

## 10. Notification Subscription

**Purpose**: Tracks a user's browser-level push subscription state.

**Core Fields**

- `id`
- `tenantId`
- `userId`
- `provider` (`onesignal`)
- `externalSubscriptionId`
- `externalUserId`
- `permissionState` (`granted`, `denied`, `default`)
- `browser`
- `platform`
- `isActive`
- `lastSyncedAt`
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to one tenant.
- Belongs to one user profile.

**Validation Rules**

- Each active provider subscription must be unique by external subscription id.
- Active subscriptions require a granted permission state.

## 11. Notification Event

**Purpose**: Represents an operational message to be delivered to subscribed users.

**Core Fields**

- `id`
- `tenantId`
- `eventType`
- `title`
- `body`
- `payload`
- `targetAudience`
- `relatedEntityType`
- `relatedEntityId`
- `status` (`queued`, `sent`, `delivered`, `failed`)
- `triggeredByUserId`
- `createdAt`
- `sentAt`
- `deliveredAt`

**Relationships**

- Belongs to one tenant.
- May reference one source entity such as POS order or stock record.

**Validation Rules**

- `title`, `body`, and `eventType` are required.
- `payload` must remain serializable.

**State Transitions**

- `queued -> sent`
- `sent -> delivered`
- `sent -> failed`

## 12. Preference Profile

**Purpose**: Stores persisted user-facing preferences in a tenant-aware manner.

**Core Fields**

- `id`
- `userId`
- `tenantId` (nullable for global defaults)
- `locale`
- `themeMode` (`light`, `dark`, `system`)
- `defaultTenantId`
- `defaultOutletId`
- `updatedAt`

**Relationships**

- Belongs to one user profile.
- May belong to one tenant.

**Validation Rules**

- `locale` must be one of the supported locales.
- `defaultTenantId` must reference a tenant the user can access.
- `defaultOutletId`, when present, must belong to the selected tenant.
