-- A closed month's books can't change, whichever code path tries. A month is closed when it has a close time
-- after any reopen. Dates: expenses carry a Nepal date string; bills and payments a UTC timestamp, read in
-- Nepal time (gotcha 30b).
CREATE OR REPLACE FUNCTION month_is_closed(m text) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM "MonthClose" c WHERE c."month" = m AND c."closedAt" IS NOT NULL AND (c."reopenedAt" IS NULL OR c."reopenedAt" < c."closedAt"));
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION nepal_month(t timestamp) RETURNS text AS $$
  SELECT to_char((t AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kathmandu', 'YYYY-MM');
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION expense_month_lock() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND month_is_closed(substr(OLD."date", 1, 7)) THEN RAISE EXCEPTION 'Month % is closed: reopen it to change its books', substr(OLD."date", 1, 7); END IF;
  IF TG_OP <> 'DELETE' AND month_is_closed(substr(NEW."date", 1, 7)) THEN RAISE EXCEPTION 'Month % is closed: reopen it to change its books', substr(NEW."date", 1, 7); END IF;
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER expense_month_lock BEFORE INSERT OR UPDATE OR DELETE ON "Expense" FOR EACH ROW EXECUTE FUNCTION expense_month_lock();

-- bills: new ones, deletions, and changes to what the month owes (paying an old bill later is that later month's event)
CREATE OR REPLACE FUNCTION bill_month_lock() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."amount" = OLD."amount" AND NEW."vatAmount" = OLD."vatAmount" AND NEW."billDate" = OLD."billDate"
     AND NEW."supplierId" = OLD."supplierId" AND NOT (NEW."status" = 'VOID' AND OLD."status" <> 'VOID') THEN RETURN NEW; END IF;
  IF TG_OP <> 'INSERT' AND month_is_closed(nepal_month(OLD."billDate")) THEN RAISE EXCEPTION 'Month % is closed: reopen it to change its books', nepal_month(OLD."billDate"); END IF;
  IF TG_OP <> 'DELETE' AND month_is_closed(nepal_month(NEW."billDate")) THEN RAISE EXCEPTION 'Month % is closed: reopen it to change its books', nepal_month(NEW."billDate"); END IF;
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER bill_month_lock BEFORE INSERT OR UPDATE OR DELETE ON "SupplierBill" FOR EACH ROW EXECUTE FUNCTION bill_month_lock();

-- payments: new ones, deletions, voiding, and changes to amount or date (allocating credit later is fine)
CREATE OR REPLACE FUNCTION payment_month_lock() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."amount" = OLD."amount" AND NEW."paidAt" = OLD."paidAt" AND NEW."supplierId" = OLD."supplierId"
     AND (NEW."voidedAt" IS NOT DISTINCT FROM OLD."voidedAt") THEN RETURN NEW; END IF;
  IF TG_OP <> 'INSERT' AND month_is_closed(nepal_month(OLD."paidAt")) THEN RAISE EXCEPTION 'Month % is closed: reopen it to change its books', nepal_month(OLD."paidAt"); END IF;
  IF TG_OP <> 'DELETE' AND month_is_closed(nepal_month(NEW."paidAt")) THEN RAISE EXCEPTION 'Month % is closed: reopen it to change its books', nepal_month(NEW."paidAt"); END IF;
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER payment_month_lock BEFORE INSERT OR UPDATE OR DELETE ON "SupplierPayment" FOR EACH ROW EXECUTE FUNCTION payment_month_lock();
