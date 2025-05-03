-- CreateTable
CREATE TABLE "SourceFileState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "lastModifiedAt" DATETIME,
    "inDjLibrary" BOOLEAN NOT NULL DEFAULT false,
    "djLastChecked" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceFileState_path_key" ON "SourceFileState"("path");

-- CreateIndex
CREATE INDEX "SourceFileState_inDjLibrary_idx" ON "SourceFileState"("inDjLibrary");

-- CreateIndex
CREATE INDEX "SourceFileState_lastModifiedAt_idx" ON "SourceFileState"("lastModifiedAt");
