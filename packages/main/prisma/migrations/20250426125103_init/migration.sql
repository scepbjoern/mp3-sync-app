-- CreateTable
CREATE TABLE "FileMappingState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceAPath" TEXT NOT NULL,
    "sourceBPath" TEXT NOT NULL,
    "mappingCreatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "artist" TEXT,
    "title" TEXT,
    "sourceALastModified" DATETIME,
    "sourceBLastModified" DATETIME,
    "lastSyncTimestamp" DATETIME
);

-- CreateTable
CREATE TABLE "SyncStateTag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileMappingStateId" INTEGER NOT NULL,
    "tagName" TEXT NOT NULL,
    "sourceAValue" TEXT,
    "sourceBValue" TEXT,
    CONSTRAINT "SyncStateTag_fileMappingStateId_fkey" FOREIGN KEY ("fileMappingStateId") REFERENCES "FileMappingState" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FileMappingState_sourceAPath_key" ON "FileMappingState"("sourceAPath");

-- CreateIndex
CREATE UNIQUE INDEX "FileMappingState_sourceBPath_key" ON "FileMappingState"("sourceBPath");

-- CreateIndex
CREATE INDEX "FileMappingState_lastSyncTimestamp_idx" ON "FileMappingState"("lastSyncTimestamp");

-- CreateIndex
CREATE INDEX "FileMappingState_artist_idx" ON "FileMappingState"("artist");

-- CreateIndex
CREATE INDEX "FileMappingState_title_idx" ON "FileMappingState"("title");

-- CreateIndex
CREATE INDEX "SyncStateTag_fileMappingStateId_idx" ON "SyncStateTag"("fileMappingStateId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncStateTag_fileMappingStateId_tagName_key" ON "SyncStateTag"("fileMappingStateId", "tagName");
