-- Copyright 2025 Circle Internet Group, Inc.  All rights reserved.
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--     http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.
--
-- SPDX-License-Identifier: Apache-2.0

UPDATE transactions
SET chain = '5042002'
WHERE chain = 'ARC-TESTNET' AND transaction_type IN ('ADMIN', 'CCTP_APPROVAL', 'CCTP_BURN', 'CCTP_MINT');

-- ADMIN rows stored the destination in wallet_id; wallet_id must hold the source.
UPDATE transactions t
SET
  wallet_id = aw.address,
  metadata = jsonb_set(
    COALESCE(t.metadata, '{}'::jsonb),
    '{migration_note}',
    '"Fixed wallet_id to represent source wallet address"'::jsonb
  )
FROM admin_wallets aw
WHERE t.transaction_type IN ('ADMIN', 'CCTP_APPROVAL', 'CCTP_BURN', 'CCTP_MINT')
  AND t.source_wallet_id = aw.id
  AND t.wallet_id != aw.address;

COMMENT ON COLUMN transactions.wallet_id IS 'For USER transactions: user wallet address that sent funds. For ADMIN transactions: source admin wallet address.';
COMMENT ON COLUMN transactions.destination_address IS 'For USER transactions: admin wallet that received funds. For ADMIN transactions: destination address receiving funds.';
