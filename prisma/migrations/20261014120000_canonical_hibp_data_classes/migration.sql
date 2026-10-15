-- HIBP data classes were stored in the plural ("passwords"), so they never counted as critical.
CREATE FUNCTION gardik_canonical_labels(labels text[]) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_agg(label ORDER BY first), '{}')
  FROM (
    SELECT CASE raw
             WHEN 'passwords' THEN 'password'
             WHEN 'credit_cards' THEN 'credit_card'
             WHEN 'bank_account_numbers' THEN 'bank_account'
             WHEN 'social_security_numbers' THEN 'ssn'
             ELSE raw
           END AS label,
           min(ord) AS first
    FROM unnest(labels) WITH ORDINALITY AS u(raw, ord)
    GROUP BY 1
  ) AS t
$$;

-- Raise, never lower: one critical type means HIGH and two mean CRITICAL, as in severityFor.
UPDATE "Alert" AS a
SET "severity" = CASE WHEN c.n >= 2 THEN 'CRITICAL'::"Severity" ELSE 'HIGH'::"Severity" END
FROM (
  SELECT r."employeeId", r."breachId",
         cardinality(ARRAY(
           SELECT unnest(gardik_canonical_labels(r."exposedData"))
           INTERSECT
           SELECT unnest(ARRAY['password', 'hashed_password', 'credit_card', 'ssn', 'bank_account'])
         )) AS n
  FROM "BreachRecord" AS r
  WHERE r."exposedData" && ARRAY['passwords', 'credit_cards', 'bank_account_numbers', 'social_security_numbers']
) AS c
WHERE a."employeeId" = c."employeeId"
  AND a."breachId" = c."breachId"
  AND c.n >= 1
  AND (a."severity" IN ('MEDIUM', 'LOW') OR (a."severity" = 'HIGH' AND c.n >= 2));

UPDATE "BreachRecord" SET "exposedData" = gardik_canonical_labels("exposedData")
WHERE "exposedData" && ARRAY['passwords', 'credit_cards', 'bank_account_numbers', 'social_security_numbers'];

UPDATE "Breach" SET "dataTypes" = gardik_canonical_labels("dataTypes")
WHERE "dataTypes" && ARRAY['passwords', 'credit_cards', 'bank_account_numbers', 'social_security_numbers'];

DROP FUNCTION gardik_canonical_labels(text[]);
