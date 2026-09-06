-- Prevent duplicate provider identities and duplicate provider links per user.
CREATE UNIQUE INDEX account_provider_account_uidx
    ON account ("providerId", "accountId");

CREATE UNIQUE INDEX account_user_provider_uidx
    ON account ("userId", "providerId");
