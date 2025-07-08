-- DropForeignKey
ALTER TABLE "Edge" DROP CONSTRAINT "Edge_articleId_fkey";

-- DropForeignKey
ALTER TABLE "Node" DROP CONSTRAINT "Node_articleId_fkey";

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edge" ADD CONSTRAINT "Edge_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
