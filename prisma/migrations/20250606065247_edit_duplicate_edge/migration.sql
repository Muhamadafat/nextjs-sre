/*
  Warnings:

  - A unique constraint covering the columns `[fromId,toId,relation]` on the table `Edge` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Edge_fromId_toId_relation_key" ON "Edge"("fromId", "toId", "relation");
