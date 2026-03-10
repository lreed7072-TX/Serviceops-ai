/**
 * qbo-types.ts — TypeScript type definitions for all QBO API entities.
 *
 * Pure types file — no runtime code, no imports outside type-only.
 * Covers all QBO entities needed across all 6 phases (minorversion=75).
 */

// ============================================
// COMMON / SHARED TYPES
// ============================================

export type QboRef = {
  value: string;
  name?: string;
};

export type QboEmailAddr = {
  Address: string;
};

export type QboPhoneNumber = {
  FreeFormNumber: string;
};

export type QboAddress = {
  Id?: string;
  Line1?: string;
  Line2?: string;
  Line3?: string;
  City?: string;
  CountrySubDivisionCode?: string;
  PostalCode?: string;
  Country?: string;
  Lat?: string;
  Long?: string;
};

export type QboMetaData = {
  CreateTime: string;
  LastUpdatedTime: string;
};

export type QboLinkedTxn = {
  TxnId: string;
  TxnType: string;
  TxnLineId?: string;
};

export type QboLine = {
  Id?: string;
  LineNum?: number;
  Description?: string;
  Amount: number;
  DetailType: string;
  SalesItemLineDetail?: {
    ItemRef?: QboRef;
    ClassRef?: QboRef;
    UnitPrice?: number;
    Qty?: number;
    TaxCodeRef?: QboRef;
    ServiceDate?: string;
  };
  AccountBasedExpenseLineDetail?: {
    AccountRef: QboRef;
    ClassRef?: QboRef;
    BillableStatus?: string;
    CustomerRef?: QboRef;
    TaxCodeRef?: QboRef;
  };
  ItemBasedExpenseLineDetail?: {
    ItemRef: QboRef;
    ClassRef?: QboRef;
    UnitPrice?: number;
    Qty?: number;
    BillableStatus?: string;
    CustomerRef?: QboRef;
    TaxCodeRef?: QboRef;
  };
  GroupLineDetail?: {
    GroupItemRef: QboRef;
    Quantity?: number;
    Line?: QboLine[];
  };
  LinkedTxn?: QboLinkedTxn[];
};

export type QboFault = {
  Error: Array<{
    Message: string;
    Detail?: string;
    code?: string;
    element?: string;
  }>;
  type?: string;
};

// ============================================
// ENTITY TYPES (18 entities, minorversion=75)
// ============================================

export type QboCustomer = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  DisplayName: string;
  Title?: string;
  GivenName?: string;
  MiddleName?: string;
  FamilyName?: string;
  Suffix?: string;
  FullyQualifiedName?: string;
  CompanyName?: string;
  PrintOnCheckName?: string;
  Active?: boolean;
  PrimaryPhone?: QboPhoneNumber;
  AlternatePhone?: QboPhoneNumber;
  Mobile?: QboPhoneNumber;
  Fax?: QboPhoneNumber;
  PrimaryEmailAddr?: QboEmailAddr;
  WebAddr?: { URI: string };
  BillAddr?: QboAddress;
  ShipAddr?: QboAddress;
  Notes?: string;
  PaymentMethodRef?: QboRef;
  SalesTermRef?: QboRef;
  CurrencyRef?: QboRef;
  Balance?: number;
  OpenBalanceDate?: string;
  PreferredDeliveryMethod?: string;
  ResaleNum?: string;
  Taxable?: boolean;
  DefaultTaxCodeRef?: QboRef;
  IsSubCustomer?: boolean;
  ParentRef?: QboRef;
  Level?: number;
  Job?: boolean;
};

export type QboInvoice = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  CustomerRef: QboRef;
  BillAddr?: QboAddress;
  ShipAddr?: QboAddress;
  ShipDate?: string;
  TrackingNum?: string;
  ClassRef?: QboRef;
  DepartmentRef?: QboRef;
  SalesTermRef?: QboRef;
  Line: QboLine[];
  TxnTaxDetail?: {
    TotalTax?: number;
    TaxLine?: Array<{
      Amount: number;
      DetailType: string;
      TaxLineDetail?: {
        TaxRateRef: QboRef;
        PercentBased?: boolean;
        TaxPercent?: number;
        NetAmountTaxable?: number;
      };
    }>;
  };
  TotalAmt: number;
  Balance: number;
  status?: string; // "Voided" when invoice has been voided in QBO
  EmailStatus?: string;
  BillEmail?: QboEmailAddr;
  LinkedTxn?: QboLinkedTxn[];
  PrintStatus?: string;
  CustomerMemo?: { value: string };
  Deposit?: number;
  ApplyTaxAfterDiscount?: boolean;
  GlobalTaxCalculation?: string;
  HomeTotalAmt?: number;
  FreeFormAddress?: boolean;
};

export type QboPayment = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  TxnDate?: string;
  CustomerRef: QboRef;
  PaymentMethodRef?: QboRef;
  PaymentRefNum?: string;
  DepositToAccountRef?: QboRef;
  TotalAmt: number;
  UnappliedAmt?: number;
  ProcessPayment?: boolean;
  Line?: Array<{
    Amount: number;
    LinkedTxn?: QboLinkedTxn[];
  }>;
};

export type QboEstimate = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  DocNumber?: string;
  TxnDate?: string;
  ExpirationDate?: string;
  CustomerRef: QboRef;
  BillAddr?: QboAddress;
  ShipAddr?: QboAddress;
  ClassRef?: QboRef;
  DepartmentRef?: QboRef;
  SalesTermRef?: QboRef;
  Line: QboLine[];
  TxnTaxDetail?: {
    TotalTax?: number;
    TaxLine?: Array<{
      Amount: number;
      DetailType: string;
    }>;
  };
  TotalAmt: number;
  TxnStatus?: string;
  CustomerMemo?: { value: string };
  EmailStatus?: string;
  BillEmail?: QboEmailAddr;
  LinkedTxn?: QboLinkedTxn[];
};

export type QboItem = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  Name: string;
  FullyQualifiedName?: string;
  Description?: string;
  Active?: boolean;
  Type: string; // "Inventory" | "Service" | "NonInventory" | "Group" | "Category"
  UnitPrice?: number;
  PurchaseCost?: number;
  IncomeAccountRef?: QboRef;
  ExpenseAccountRef?: QboRef;
  AssetAccountRef?: QboRef;
  TrackQtyOnHand?: boolean;
  QtyOnHand?: number;
  InvStartDate?: string;
  PurchaseDesc?: string;
  SubItem?: boolean;
  ParentRef?: QboRef;
  Level?: number;
  ClassRef?: QboRef;
  Taxable?: boolean;
  SalesTaxCodeRef?: QboRef;
  PurchaseTaxCodeRef?: QboRef;
};

export type QboEmployee = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  DisplayName: string;
  Title?: string;
  GivenName?: string;
  MiddleName?: string;
  FamilyName?: string;
  Suffix?: string;
  PrintOnCheckName?: string;
  Active?: boolean;
  PrimaryPhone?: QboPhoneNumber;
  Mobile?: QboPhoneNumber;
  PrimaryEmailAddr?: QboEmailAddr;
  PrimaryAddr?: QboAddress;
  EmployeeNumber?: string;
  SSN?: string;
  HiredDate?: string;
  ReleasedDate?: string;
  BillableTime?: boolean;
  BillRate?: number;
  Organization?: boolean;
  V4IDPseudonym?: string;
};

export type QboVendor = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  DisplayName: string;
  Title?: string;
  GivenName?: string;
  FamilyName?: string;
  CompanyName?: string;
  PrintOnCheckName?: string;
  Active?: boolean;
  PrimaryPhone?: QboPhoneNumber;
  AlternatePhone?: QboPhoneNumber;
  Mobile?: QboPhoneNumber;
  Fax?: QboPhoneNumber;
  PrimaryEmailAddr?: QboEmailAddr;
  WebAddr?: { URI: string };
  BillAddr?: QboAddress;
  Term?: QboRef;
  CurrencyRef?: QboRef;
  Vendor1099?: boolean;
  Balance?: number;
  AcctNum?: string;
  TaxIdentifier?: string;
};

export type QboTimeActivity = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  TxnDate: string;
  NameOf: string; // "Employee" | "Vendor" | "Other"
  EmployeeRef?: QboRef;
  VendorRef?: QboRef;
  CustomerRef?: QboRef;
  ItemRef?: QboRef;
  ClassRef?: QboRef;
  DepartmentRef?: QboRef;
  BillableStatus?: string; // "Billable" | "NotBillable" | "HasBeenBilled"
  Taxable?: boolean;
  HourlyRate?: number;
  Hours?: number;
  Minutes?: number;
  StartTime?: string;
  EndTime?: string;
  Description?: string;
  BreakHours?: number;
  BreakMinutes?: number;
};

export type QboBill = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  VendorRef: QboRef;
  APAccountRef?: QboRef;
  DepartmentRef?: QboRef;
  Line: QboLine[];
  LinkedTxn?: QboLinkedTxn[];
  TotalAmt?: number;
  Balance?: number;
  SalesTermRef?: QboRef;
  GlobalTaxCalculation?: string;
};

export type QboPurchase = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  PaymentType: string; // "Cash" | "Check" | "CreditCard"
  AccountRef: QboRef;
  EntityRef?: QboRef;
  TxnDate?: string;
  DocNumber?: string;
  DepartmentRef?: QboRef;
  Line: QboLine[];
  TotalAmt?: number;
  LinkedTxn?: QboLinkedTxn[];
};

export type QboPurchaseOrder = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  VendorRef: QboRef;
  APAccountRef?: QboRef;
  ShipTo?: QboRef;
  ShipAddr?: QboAddress;
  DepartmentRef?: QboRef;
  ClassRef?: QboRef;
  POStatus?: string; // "Open" | "Closed"
  Line: QboLine[];
  TotalAmt?: number;
  Memo?: string;
  VendorAddr?: QboAddress;
  EmailStatus?: string;
  BillEmail?: QboEmailAddr;
};

export type QboCreditMemo = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  DocNumber?: string;
  TxnDate?: string;
  CustomerRef: QboRef;
  DepartmentRef?: QboRef;
  ClassRef?: QboRef;
  SalesTermRef?: QboRef;
  Line: QboLine[];
  TxnTaxDetail?: {
    TotalTax?: number;
    TaxLine?: Array<{
      Amount: number;
      DetailType: string;
    }>;
  };
  TotalAmt: number;
  Balance?: number;
  RemainingCredit?: number;
  LinkedTxn?: QboLinkedTxn[];
  CustomerMemo?: { value: string };
  BillEmail?: QboEmailAddr;
  EmailStatus?: string;
  BillAddr?: QboAddress;
};

export type QboAccount = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  Name: string;
  FullyQualifiedName?: string;
  Description?: string;
  Active?: boolean;
  Classification?: string; // "Asset" | "Equity" | "Expense" | "Liability" | "Revenue"
  AccountType: string;
  AccountSubType?: string;
  AcctNum?: string;
  CurrencyRef?: QboRef;
  ParentRef?: QboRef;
  SubAccount?: boolean;
  CurrentBalance?: number;
  CurrentBalanceWithSubAccounts?: number;
};

export type QboClass = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  Name: string;
  FullyQualifiedName?: string;
  Active?: boolean;
  SubClass?: boolean;
  ParentRef?: QboRef;
};

export type QboLocation = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  Name: string;
  FullyQualifiedName?: string;
  Active?: boolean;
  SubDepartment?: boolean;
  ParentDepartmentRef?: QboRef;
};

export type QboPreferences = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  AccountingInfoPrefs?: {
    ClassTrackingPerTxn?: boolean;
    ClassTrackingPerTxnLine?: boolean;
    TrackDepartments?: boolean;
    DepartmentTerminology?: string;
    FirstMonthOfFiscalYear?: string;
    TaxYearMonth?: string;
    BookCloseDate?: string;
  };
  ProductAndServicesPrefs?: {
    ForSales?: boolean;
    ForPurchase?: boolean;
    QuantityWithPriceAndRate?: boolean;
    QuantityOnHand?: boolean;
  };
  SalesFormsPrefs?: {
    CustomTxnNumbers?: boolean;
    AllowDeposit?: boolean;
    AllowDiscount?: boolean;
    AllowEstimates?: boolean;
    AllowServiceDate?: boolean;
    AllowShipping?: boolean;
    DefaultTerms?: QboRef;
    DefaultCustomerMessage?: string;
  };
  TimeTrackingPrefs?: {
    UseServices?: boolean;
    BillCustomers?: boolean;
    ShowBillRateToAll?: boolean;
    WorkWeekStartDate?: string;
    MarkTimeEntriesBillable?: boolean;
  };
  TaxPrefs?: {
    UsingSalesTax?: boolean;
    TaxGroupCodeRef?: QboRef;
  };
};

export type QboCompanyInfo = {
  Id: string;
  SyncToken: string;
  MetaData?: QboMetaData;
  CompanyName: string;
  LegalName?: string;
  CompanyAddr?: QboAddress;
  CustomerCommunicationAddr?: QboAddress;
  LegalAddr?: QboAddress;
  PrimaryPhone?: QboPhoneNumber;
  CompanyStartDate?: string;
  FiscalYearStartMonth?: string;
  Country?: string;
  Email?: QboEmailAddr;
  WebAddr?: { URI: string };
  SupportedLanguages?: string;
  NameValue?: Array<{ Name: string; Value: string }>;
};

// ============================================
// BATCH API TYPES
// ============================================

/** A single operation in a QBO batch request */
export type QboBatchOperation =
  | {
      bId: string;
      operation: "create" | "update" | "delete";
      [entity: string]: unknown;
    }
  | {
      bId: string;
      Query: string;
    };

/** A single response item from a QBO batch response */
export type QboBatchItemResponse = {
  bId: string;
  Fault?: QboFault;
  QueryResponse?: Record<string, unknown>;
  [entity: string]: unknown;
};

// ============================================
// RESPONSE WRAPPER TYPES
// ============================================

export type QboQueryResponse<T> = {
  QueryResponse: {
    startPosition?: number;
    maxResults?: number;
    totalCount?: number;
  } & { [key: string]: T[] | number | undefined };
};

export type QboCdcResponse = {
  CDCResponse: Array<{
    QueryResponse: Array<{
      startPosition?: number;
      maxResults?: number;
    } & Record<string, unknown>>;
  }>;
};

// ============================================
// REPORTS API TYPES
// ============================================

export type QboReportRow = {
  type: "Section" | "Data" | "GrandTotal";
  Header?: { ColData: Array<{ value: string; id?: string }> };
  Rows?: { Row: QboReportRow[] };
  Summary?: { ColData: Array<{ value: string; id?: string }> };
  ColData?: Array<{ value: string; id?: string }>;
};

export type QboReportResponse = {
  Header: {
    ReportName: string;
    StartPeriod?: string;
    EndPeriod?: string;
    Currency?: string;
    ReportBasis?: string;
  };
  Columns: { Column: Array<{ ColTitle: string; ColType: string }> };
  Rows: { Row: QboReportRow[] };
};
