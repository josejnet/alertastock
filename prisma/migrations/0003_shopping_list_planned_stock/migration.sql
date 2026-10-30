ALTER TABLE "ShoppingItem" ADD COLUMN "plannedStockId" TEXT;

CREATE UNIQUE INDEX "ShoppingItem_userId_plannedStockId_key" ON "ShoppingItem"("userId", "plannedStockId");

ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_plannedStockId_fkey" FOREIGN KEY ("plannedStockId") REFERENCES "PlannedStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
