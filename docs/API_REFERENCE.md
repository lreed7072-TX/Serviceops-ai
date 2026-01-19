# ServiceOps AI - API Reference

## Authentication
All API routes require authentication via Supabase session.

**Headers:**
```
Cookie: sb-access-token=...
```

**Auth Context:**
```typescript
{
  userId: string;    // Supabase user ID
  orgId: string;     // Organization ID
  role: Role;        // ADMIN | TECH | VIEWER
}
```

---

## Analytics APIs

### GET /api/analytics/revenue
Revenue analytics and trends.

**Query Parameters:**
- `startDate` (optional): ISO date string (default: 30 days ago)
- `endDate` (optional): ISO date string (default: today)

**Response:**
```json
{
  "data": {
    "summary": {
      "totalRevenue": number,
      "paidRevenue": number,
      "outstandingRevenue": number,
      "invoiceCount": number,
      "totalChange": number,      // % vs previous period
      "paidChange": number
    },
    "breakdown": {
      "laborRevenue": number,
      "materialRevenue": number,
      "otherRevenue": number,
      "laborPercentage": number,
      "materialPercentage": number
    },
    "topCustomers": [
      {
        "customerId": string,
        "customerName": string,
        "revenue": number,
        "invoiceCount": number
      }
    ],
    "monthlyTrend": [
      {
        "month": string,          // YYYY-MM
        "revenue": number,
        "invoiceCount": number
      }
    ],
    "collections": {
      "averageDaysToPayment": number,
      "paidInvoices": number,
      "unpaidInvoices": number
    }
  }
}
```

---

### GET /api/analytics/work-orders
Work order performance metrics.

**Query Parameters:**
- `startDate`, `endDate` (same as revenue)

**Response:**
```json
{
  "data": {
    "summary": {
      "totalWorkOrders": number,
      "completedWorkOrders": number,
      "completionRate": number,
      "avgCompletionDays": number,
      "totalLaborHours": number
    },
    "statusDistribution": {
      "OPEN": number,
      "IN_PROGRESS": number,
      "COMPLETED": number,
      "CANCELED": number
    },
    "typeDistribution": {
      "WORK_ORDER": number,
      "QUOTE": number,
      "WARRANTY": number
    },
    "topCustomers": [
      {
        "customerId": string,
        "customerName": string,
        "count": number
      }
    ],
    "technicianPerformance": [
      {
        "userId": string,
        "userName": string,
        "taskCount": number,
        "completedTasks": number,
        "completionRate": number
      }
    ],
    "monthlyTrend": [
      {
        "month": string,
        "count": number,
        "completed": number
      }
    ]
  }
}
```

---

### GET /api/analytics/materials
Material usage and cost analytics.

**Query Parameters:**
- `startDate`, `endDate` (same as revenue)

**Response:**
```json
{
  "data": {
    "summary": {
      "totalUsages": number,
      "totalMaterialCost": number,
      "uniqueMaterialsUsed": number,
      "lowStockCount": number,
      "inventoryValue": number
    },
    "topMaterials": [
      {
        "materialId": string,
        "materialName": string,
        "category": string,
        "usageCount": number,
        "totalQuantity": number,
        "totalCost": number
      }
    ],
    "categoryDistribution": {
      "[category]": {
        "count": number,
        "totalCost": number
      }
    },
    "monthlyTrend": [
      {
        "month": string,
        "usageCount": number,
        "totalCost": number
      }
    ]
  }
}
```

---

### GET /api/analytics/quotes
Quote conversion and pipeline analytics.

**Query Parameters:**
- `startDate`, `endDate` (same as revenue)

**Response:**
```json
{
  "data": {
    "summary": {
      "totalQuotes": number,
      "sentQuotes": number,
      "approvedQuotes": number,
      "rejectedQuotes": number,
      "conversionRate": number,
      "rejectionRate": number,
      "avgQuoteValue": number,
      "avgTimeToDecisionDays": number,
      "pipelineValue": number,
      "activeQuotesCount": number
    },
    "statusDistribution": {
      "DRAFT": number,
      "SENT": number,
      "APPROVED": number,
      "REJECTED": number,
      "EXPIRED": number,
      "CONVERTED": number,
      "CANCELED": number
    },
    "topCustomers": [
      {
        "customerId": string,
        "customerName": string,
        "totalValue": number,
        "count": number,
        "approvedValue": number,
        "approvedCount": number,
        "conversionRate": number
      }
    ],
    "monthlyTrend": [
      {
        "month": string,
        "count": number,
        "totalValue": number,
        "approvedCount": number,
        "approvedValue": number,
        "conversionRate": number
      }
    ]
  }
}
```

---

### GET /api/analytics/export
Export analytics data as CSV.

**Query Parameters:**
- `type`: "revenue" | "work-orders" | "materials" | "quotes" (required)
- `startDate`, `endDate` (optional, same as other analytics)

**Response:**
- Content-Type: text/csv
- Content-Disposition: attachment with filename
- CSV data with appropriate headers for selected type

**Example:**
```
GET /api/analytics/export?type=revenue&startDate=2025-01-01&endDate=2025-01-31
```

---

## Inventory APIs

### POST /api/stock-movements
Record inventory stock movement.

**Request Body:**
```json
{
  "materialId": "uuid",
  "movementType": "PURCHASE" | "ADJUSTMENT" | "USAGE" | "RETURN" | "TRANSFER" | "WRITE_OFF",
  "quantity": number,
  "unitCost": number (optional, for PURCHASE),
  "reference": string (optional, e.g., "PO-12345"),
  "notes": string (optional)
}
```

**Response:**
```json
{
  "movement": {
    "id": "uuid",
    "materialId": "uuid",
    "movementType": string,
    "quantity": number,
    "quantityBefore": number,
    "quantityAfter": number,
    "unitCost": number,
    "totalCost": number,
    "reference": string,
    "notes": string,
    "performedByUserId": "uuid",
    "createdAt": datetime,
    "material": { ... },
    "performedBy": { ... }
  }
}
```

**Validation:**
- Quantity must be positive
- PURCHASE/ADJUSTMENT increase stock
- USAGE/WRITE_OFF decrease stock
- Prevents negative stock levels

---

### GET /api/stock-movements
Get stock movement history.

**Query Parameters:**
- `materialId` (optional): Filter by material
- `movementType` (optional): Filter by type
- `limit` (optional): Max results (default: 100)

**Response:**
```json
{
  "movements": [
    {
      "id": "uuid",
      "materialId": "uuid",
      "movementType": string,
      "quantity": number,
      "quantityBefore": number,
      "quantityAfter": number,
      "createdAt": datetime,
      // ... full movement details
    }
  ]
}
```

---

### GET /api/inventory/low-stock
Get materials below minimum quantity.

**Response:**
```json
{
  "lowStockMaterials": [
    {
      "id": "uuid",
      "name": string,
      "partNumber": string,
      "category": string,
      "quantityOnHand": number,
      "minQuantity": number,
      "shortfall": number,
      "percentOfMinimum": number
    }
  ]
}
```

---

## Customer & Site APIs

### GET /api/customers
List all customers for org.

**Response:**
```json
{
  "customers": [
    {
      "id": "uuid",
      "name": string,
      "email": string,
      "phone": string,
      "address": string,
      "isActive": boolean,
      "createdAt": datetime
    }
  ]
}
```

---

### POST /api/customers
Create new customer.

**Request Body:**
```json
{
  "name": string (required),
  "email": string (optional),
  "phone": string (optional),
  "address": string (optional)
}
```

---

### GET /api/customers/[id]
Get customer details.

**Response:** Single customer object with sites

---

### PATCH /api/customers/[id]
Update customer.

**Request Body:** Partial customer fields

---

### DELETE /api/customers/[id]
Delete customer (soft delete).

---

### GET /api/sites
List sites (optionally filtered by customerId).

**Query Parameters:**
- `customerId` (optional): Filter by customer

---

### POST /api/sites
Create new site.

**Request Body:**
```json
{
  "customerId": "uuid" (required),
  "name": string (required),
  "address": string (optional),
  "contactName": string (optional),
  "contactPhone": string (optional),
  "contactEmail": string (optional)
}
```

---

## Material APIs

### GET /api/materials
List all materials for org.

**Query Parameters:**
- `category` (optional): Filter by category
- `isActive` (optional): Filter active/inactive

**Response:**
```json
{
  "materials": [
    {
      "id": "uuid",
      "name": string,
      "partNumber": string,
      "category": string,
      "description": string,
      "unitCost": number,
      "quantityOnHand": number,
      "minQuantity": number,
      "maxQuantity": number,
      "location": string,
      "lastRestocked": datetime,
      "isActive": boolean
    }
  ]
}
```

---

### POST /api/materials
Create new material.

**Request Body:**
```json
{
  "name": string (required),
  "partNumber": string (optional),
  "category": MaterialCategory (required),
  "description": string (optional),
  "unitCost": number (optional),
  "quantityOnHand": number (default: 0),
  "minQuantity": number (optional),
  "maxQuantity": number (optional),
  "location": string (optional)
}
```

---

## Work Order APIs

### GET /api/work-orders
List work orders.

**Query Parameters:**
- `status` (optional): Filter by status
- `customerId` (optional): Filter by customer
- `limit` (optional): Max results

---

### POST /api/work-orders
Create new work order.

**Request Body:**
```json
{
  "customerId": "uuid" (required),
  "siteId": "uuid" (required),
  "assetId": "uuid" (optional),
  "quoteId": "uuid" (optional),
  "title": string (required),
  "description": string (optional),
  "orderType": OrderType (default: WORK_ORDER),
  "executionMode": ExecutionMode (default: UNIFIED)
}
```

---

### GET /api/work-orders/[id]
Get work order details with tasks, time entries, materials.

---

### PATCH /api/work-orders/[id]
Update work order.

---

## Invoice APIs

### GET /api/invoices
List invoices.

**Query Parameters:**
- `status` (optional): Filter by status
- `customerId` (optional): Filter by customer

---

### POST /api/invoices
Create new invoice.

**Request Body:**
```json
{
  "customerId": "uuid" (required),
  "siteId": "uuid" (optional),
  "workOrderId": "uuid" (optional),
  "title": string (required),
  "description": string (optional),
  "dueDate": datetime (optional),
  "taxRate": number (default: 0),
  "notes": string (optional),
  "terms": string (optional),
  "lineItems": [
    {
      "itemType": InvoiceLineItemType (required),
      "description": string (required),
      "quantity": number (default: 1),
      "unitPrice": number (required)
    }
  ]
}
```

**Auto-calculates:**
- Line item totals
- Subtotal
- Tax
- Grand total

---

### PATCH /api/invoices/[id]
Update invoice status, mark as paid, etc.

---

## Quote APIs

### GET /api/quotes
List quotes.

---

### POST /api/quotes
Create new quote.

**Request Body:**
```json
{
  "customerId": "uuid" (required),
  "siteId": "uuid" (optional),
  "title": string (required),
  "description": string (optional),
  "expiresAt": datetime (optional),
  "taxRate": number (default: 0),
  "notes": string (optional),
  "terms": string (optional),
  "lineItems": [
    {
      "itemType": QuoteLineItemType (required),
      "description": string (required),
      "quantity": number (default: 1),
      "unitPrice": number (required)
    }
  ]
}
```

---

### PATCH /api/quotes/[id]
Update quote or convert to work order.

**For conversion:**
```json
{
  "status": "CONVERTED"
}
```

Creates corresponding work order automatically.

---

## Error Responses

**Standard Error Format:**
```json
{
  "error": "Error message description"
}
```

**Common Status Codes:**
- 400: Bad Request (validation error)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 500: Internal Server Error

---

## Rate Limiting
Currently no rate limiting implemented. Consider adding for production at scale.

## Pagination
Most list endpoints support basic pagination via `limit` parameter. Consider implementing cursor-based pagination for large datasets.
