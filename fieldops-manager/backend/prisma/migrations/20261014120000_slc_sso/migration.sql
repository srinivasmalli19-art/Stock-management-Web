-- SLC central sign-in (Keycloak) for Super_Admin / Admin.
ALTER TABLE "User" ADD COLUMN "ssoSubject" TEXT;
CREATE UNIQUE INDEX "User_ssoSubject_key" ON "User"("ssoSubject");

ALTER TABLE "RefreshToken" ADD COLUMN "ssoSid" TEXT;
CREATE INDEX "RefreshToken_ssoSid_idx" ON "RefreshToken"("ssoSid");
