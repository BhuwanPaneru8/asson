# Asson — Tax invoices and IRD electronic billing (CBMS)

> **Status (15 Nov 2026):** built to the official sources below. **The owner's accountant must confirm the open questions (§6) before go-live.** Nothing is sent to the IRD until CBMS is switched on (§5).
>
> Code: `lib/invoices.ts` (issuing, credit notes, prints), `lib/invoice-math.ts` (figures), `lib/nepali-calendar.ts` (BS dates), `lib/cbms.ts` (IRD outbox), `components/invoices/*` (documents). Tests: `tests/unit/invoices.test.ts`, `tests/integration/invoices.test.ts`, `tests/e2e/invoices.spec.ts`.

---

## 1. Sources

| Source | Kind | What we took from it |
|---|---|---|
| [VAT Act 2052 (as amended), IRD](https://ird.gov.np/content/13407/value-added-tax-act--2052--as-amended/) | Official | Duty to issue a tax invoice on every taxable supply; 13% rate |
| [VAT Rules 2053 (27th amendment), IRD](https://ird.gov.np/content/13412/value-added-tax-rules--2053--with-twenty-seventh/) | Official, page only (the rule text did not render) | Rule 17 (tax invoice), Rule 18 (abbreviated tax invoice): **contents read from secondary sources below** |
| [IRD notice on issuing bills (26 Asar 2083)](https://ird.gov.np/content/13574/notice-regarding-issuance-of-will-invoice-/) | Official | A bill must be issued on every sale under Rule 17; checked in market inspections |
| [Electronic Billing Procedure 2074, 4th amendment (IRD listing)](https://ird.gov.np/content/5490/tax-laws-16910453028/) and [full text PDF (hosted by Baker Tilly Nepal)](https://bakertilly.com.np/storage/download/1645950041_Electronic_Billing_Procedure,_2074_(4th_amendment).pdf) | Official text (Nepali), read from the PDF | Software rules (§6), Schedule 5 (sales "materialized view" fields), Schedule 6 (invoice and abbreviated-invoice format), "Copy of Original" reprints, audit trail, no deletion, cancellation with a reason, branches use the same software |
| [CBMS API Documentation, updated 2079 Ashoj 28 (14 Oct 2022), IRD](https://giwmscdnone.gov.np/media/pdf_upload/976029276_qtd1hcg.pdf) | Official | Endpoints, JSON fields, response codes (§5) |
| [nepaltaxes.com: invoices and abbreviated invoices](https://nepaltaxes.com/provisions-relating-to-invoices-guide-to-invoice-abbreviated-tax-invoice/) | Secondary | Rs 10,000 ceiling and permission for abbreviated invoices; credit/debit note contents; three copies |
| [Baker Tilly: 4th amendment notice](https://www.bakertilly.com.np/tax-portal/notices-and-circulars/electronic-billing-procedure-2074-4th-amendment) | Secondary | Amendment published 5 Oct 2021 |
| [github.com/Manjish/ird-cbms](https://github.com/Manjish/ird-cbms) | Third-party client | Observed CBMS behaviour (test account, duplicate credit notes accepted) |
| Vendor pages on CBMS thresholds (e.g. [companysathi.com](https://companysathi.com/blog/electronic-billing-mandate-nepal-2026), [neuralyug.com](https://neuralyug.com/blog/ird-e-billing-cbms-automation-nepal/)) | Secondary, conflicting | Real-time sync threshold: Rs 25 crore widely cited; Rs 20 crore (notice of 4 Baishakh 2083) and Rs 15 crore also claimed — **unconfirmed** |

## 2. What a document must show, and what Asson prints

Schedule 6 of the Electronic Billing Procedure (tax invoice, "कर बीजक"):

| Required | Asson |
|---|---|
| Heading "Tax Invoice" | "TAX INVOICE / कर बीजक" ("ABBREVIATED TAX INVOICE / संक्षिप्त कर बीजक", "CREDIT NOTE") |
| Bill number | `FLAGSHIP-8384-000123` (series, fiscal year 2083/84, number in the year) |
| Transaction date and invoice issue date | Issue date in **BS and AD** with the time (sale and issue are the same moment at the till; online: the delivery/collection moment) |
| Seller's name, address, PAN | `store.legalName` (else `store.name`), the shop's address (online: `store.storeAddress`), `store.vatNumber` — **PAN is empty today: invoices print "PAN/VAT No.: not set" until the owner adds it** |
| Purchaser's name, address, PAN | Name (till: typed, else "Walk-in customer"; online: delivery name), delivery address, PAN when given (9 digits, checked by the database) |
| Method of payment (cash/cheque/credit/other) | Till tenders (Cash, eSewa QR, Card…), Cash on delivery, eSewa/Khalti |
| S.No., details, quantity, rate, amount | Lines with size/colour and SKU; rates and amounts **before VAT** |
| Amount, discount, taxable amount, VAT 13%, total | Exactly these, adding up to the paisa (`documentFigures`); the delivery charge is its own line |
| Total in words | "Two thousand three hundred ninety-nine rupees only" (crore/lakh grouping) |
| Authorised signature | A4 only (the till roll has no space; see §6) |

**VAT is split from the document total** (`round(total × 13 / 113)`), the same as the sales register and the VAT return, so the three always agree.

Credit notes carry, as the VAT Rules ask: their own number and date, supplier and recipient (with PAN when registered), **the number and date of the invoice they correct**, the reason, the amount and the VAT.

## 3. Numbering, immutability, reprints

- **Gap-free per fiscal year and series.** Fiscal year = Shrawan 1 to the last day of Asar, from the BS date of issue (`fiscalYearOf`). Series = the till's location code (`FLAGSHIP`, `PKR1`), and `WEB` for online orders (`store.invoices.onlineSeries`). Credit notes have their own series (`CN-…`). Numbers come from the `InvoiceSeries` counter, incremented with `UPDATE … RETURNING` **inside the sale's transaction**: the row lock serialises issuers, and if the sale fails its number rolls back with it. Tested with 25 concurrent issuers and a failing one (and the test fails if the counter is replaced by "max + 1").
- **Separate from order numbers.** Orders keep `AS000123`; the invoice shows the order number as a reference.
- **When.** Till sale: at the sale. Online order: when delivered (courier or COD) or collected at the shop (`transitionOrder → DELIVERED`). Free size-exchange replacements get no invoice (the original covers the goods).
- **Never changed.** Database triggers refuse `UPDATE`/`DELETE` on `TaxInvoice`, `CreditNote` and `InvoicePrint`; CHECK constraints keep `gross − discount = taxable`, `taxable + VAT = total`. Corrections are credit notes.
- **Returns are credit notes.** A till return (`processReturn`) issues one for the refunded lines; an online order returned whole (`→ RETURNED`) issues one for what till returns haven't already credited (goods less discount and points; the delivery charge isn't refunded). A credit note can never exceed what's left on its invoice (invoice row locked while checking).
- **Reprints.** The first print is the original; every later print is marked **"Copy of original (n)"** (the procedure's "प्रतिलिपि / Copy of Original" with the print count). Prints go through the Print button only (Ctrl+P prints a note instead), each is a row in `InvoicePrint` and an audit entry (`invoice.print` / `invoice.reprint`). The customer's online A4 page is marked "Customer copy (electronic)" and isn't counted (§6).
- **Sales from before invoicing started** (before the first invoice) stay in the registers under their order numbers, as before. Credit notes are only issued against invoices.

## 4. Where it shows

- Till: `/admin/pos/receipt/[order]` (80 mm invoice), `/admin/pos/return/[return]` (80 mm credit note). Buyer PAN field under "Customer (optional)".
- Staff A4: `/admin/finance/invoices/[id]`, `/admin/finance/invoices/credit/[id]`; links on the admin order page.
- **Finance → Tax invoices** (`/admin/finance/invoices`): every invoice and credit note with BS/AD dates, prints and CBMS state.
- Customer: `/orders/[id]/invoice` (A4, print or save as PDF), linked from the order page once invoiced.
- **Sales register CSV** (Finance → Accounting export): one row per invoice (number, BS date, buyer PAN, order); returns register: one row per credit note against its invoice. **VAT returns** are computed from these documents and show the number ranges they cover.
- Timing difference with the P&L: the P&L counts online orders by order date; invoices by delivery date. The export page shows the orders not yet invoiced.

## 5. CBMS (Central Billing Monitoring System)

From the IRD's API document (official):

| | |
|---|---|
| Bill | `POST https://cbapi.ird.gov.np/api/bill` |
| Credit note | `POST https://cbapi.ird.gov.np/api/billreturn` |
| Auth | `username`, `password` (the **taxpayer portal login**), `seller_pan` in the JSON body |
| Bill fields | `buyer_pan`, `buyer_name`, `fiscal_year` ("2083.084"), `invoice_number`, `invoice_date` (BS "2083.07.29"), `total_sales`, `taxable_sales_vat`, `vat`, `excisable_amount`, `excise`, `taxable_sales_hst`, `hst`, `amount_for_esf`, `esf`, `export_sales`, `tax_exempted_sales`, `isrealtime`, `datetimeClient` (amounts in rupees) |
| Credit-note fields | the same plus `ref_invoice_number`, `credit_note_number`, `credit_note_date`, `reason_for_return` |
| Replies | 200 success · 100 credentials don't match · 101 bill already exists (bill) / doesn't exist (return) · 102 exception saving · 103 unknown exception · 104 model invalid · 105 bill doesn't exist (for sales return) |

Asson: every document gets a `CbmsSync` outbox row in the transaction that issues it. The `cbms.sync` job (every minute, plus right after a sale) posts them oldest first, invoices before their credit notes, with retries and backoff; 101 on a bill counts as sent (an earlier post landed); 104 stops retrying (shown as Refused). `isrealtime` is true when posted within `store.invoices.cbmsRealtimeMinutes` (10) of issue.

**Off by default.** To switch on (server env only, never in code): `CBMS_MODE=live`, `CBMS_USERNAME`, `CBMS_PASSWORD`, `CBMS_SELLER_PAN` (and optionally `CBMS_URL`). Rows waiting from before are then posted with `isrealtime: false`. Software used for CBMS must also be **enlisted/approved by the IRD** (procedure §4): that's an application by the business, not a code change.

What the procedure asks of the software, and where we stand:

| Procedure §6 | Asson |
|---|---|
| Database management system, SQL queries | PostgreSQL |
| Data can't be deleted | Triggers on invoices, credit notes, prints, audit log |
| All activity logged; backup and recovery | Audit log; hourly production backups |
| Each record shows date, time, who entered it | `issuedAt`, `issuedById`; prints with person and time |
| Schedule 5 "materialized view" (Fiscal Year, Bill_no, Customer_name, Customer_Pan, Bill_Date, Amount, Discount, Taxable_Amount, Tax_Amount, Total_Amount, Sync with IRD, IS_Bill_Printed, Is_bill_Active, Printed_Time, Entered_By, Printed_by, Is_realtime, Payment_Method, VAT_Refund_Amount, Transaction Id) | All the data exists (invoice, `InvoicePrint`, `CbmsSync`); shown on Finance → Tax invoices and in the sales register CSV. **A single report/view with exactly these columns is not built yet** (follow-up if the enlistment asks for it) |
| An invoice can be printed only once as original; later prints "Copy of Original" with the count | Done |
| Cancellation with the reason recorded and reported | Not offered: an issued invoice is corrected only by a credit note (§6 Q4) |
| Audit trail / activity log report | Admin → Activity |
| Export to Excel/XML/PDF | CSV registers; A4 documents print to PDF |
| Sync with CBMS (above threshold) | Ready, off |

## 6. Open questions for the accountant

1. **CBMS threshold.** Which annual turnover makes real-time CBMS mandatory today: Rs 25 crore, or the lower figure (Rs 20 crore, notice of 4 Baishakh 2083) some sources cite? Until Asson is above it, keep CBMS off (rows wait).
2. **Business PAN and registered name** to print (`store.vatNumber`, `store.legalName`), and whether each shop's address on its invoices is right.
3. **Abbreviated invoices.** Do we want the tax officer's permission (Rule 18) for till sales up to Rs 10,000? Off now: every sale gets a full tax invoice. Once granted, set `store.invoices.abbreviated: true`; a buyer with a PAN always gets a full one.
4. **Same-day cancellation.** The procedure allows cancelling an issued bill with a recorded reason. We only allow credit notes. Is that acceptable, or should a till be able to cancel (void) a bill issued by mistake?
5. **When online orders are invoiced.** We invoice on delivery/collection (goods reach the customer). Prepaid online orders (eSewa/Khalti, not live yet) are paid earlier: should their invoice date be the payment date (VAT Act time of supply = earliest of invoice, delivery, payment)?
6. **Series.** One series per shop plus `WEB` for online, each restarting at 1 every fiscal year. Is a separate online series acceptable, and should the abbreviated and full invoices share one series (they do now)?
7. **Credit notes' fiscal year in CBMS.** We send the original invoice's fiscal year with the credit note; confirm (the API only says `fiscal_year`).
8. **Buyer PAN rule.** Is a buyer's PAN required above some amount (we found no official threshold), or only when the buyer gives it?
9. **The delivery charge** is on the invoice as a VAT-able line and isn't credited when goods come back: confirm.
10. **Customer's electronic copy** (`/orders/[id]/invoice`) is marked "Customer copy (electronic)" and not counted as a print. Is that the right marking, and should we email it (we have no email sender yet; the order page links it)?
11. **Copies.** The Rules mention an original and copies kept by the seller; paper copies at the till are numbered reprints and everything is stored electronically. Is printing only the customer's original enough?
12. **Signature** on the 80 mm roll: the format shows "Authorised signature"; the till roll omits it. OK?

## 7. Calendar

BS dates come from a month-length table in `lib/nepali-calendar.ts` (2080–2088 BS), checked against known dates (1 Shrawan 2081 = 16 Jul 2024; 1 Baisakh 2083 = 14 Apr 2026; 1 Shrawan 2083 = 17 Jul 2026). **Years from 2084 on are the commonly published projection: check them against the official calendar (Nepal Panchanga Nirnayak Samiti) when it is published, and extend the table each year.** A unit test fails when the table covers less than a year ahead, and issuing an invoice fails loudly (the sale doesn't go through) outside the table rather than printing a wrong date.
