-- Normalize warehouse city to "Town, ST" format using state abbreviations
WITH normalized AS (
  SELECT
    id,
    trim(split_part(city, ',', 1)) AS town,
    trim(regexp_replace(split_part(city, ',', 2), '\s+\d{5}(-\d{4})?$', '', 'g')) AS state_raw
  FROM warehouses
  WHERE city IS NOT NULL
    AND city LIKE '%,%'
),
mapped AS (
  SELECT
    id,
    town,
    CASE
      WHEN length(state_raw) = 2 THEN upper(state_raw)
      WHEN lower(state_raw) = 'alabama' THEN 'AL'
      WHEN lower(state_raw) = 'alaska' THEN 'AK'
      WHEN lower(state_raw) = 'arizona' THEN 'AZ'
      WHEN lower(state_raw) = 'arkansas' THEN 'AR'
      WHEN lower(state_raw) = 'california' THEN 'CA'
      WHEN lower(state_raw) = 'colorado' THEN 'CO'
      WHEN lower(state_raw) = 'connecticut' THEN 'CT'
      WHEN lower(state_raw) = 'delaware' THEN 'DE'
      WHEN lower(state_raw) = 'district of columbia' THEN 'DC'
      WHEN lower(state_raw) = 'florida' THEN 'FL'
      WHEN lower(state_raw) = 'georgia' THEN 'GA'
      WHEN lower(state_raw) = 'hawaii' THEN 'HI'
      WHEN lower(state_raw) = 'idaho' THEN 'ID'
      WHEN lower(state_raw) = 'illinois' THEN 'IL'
      WHEN lower(state_raw) = 'indiana' THEN 'IN'
      WHEN lower(state_raw) = 'iowa' THEN 'IA'
      WHEN lower(state_raw) = 'kansas' THEN 'KS'
      WHEN lower(state_raw) = 'kentucky' THEN 'KY'
      WHEN lower(state_raw) = 'louisiana' THEN 'LA'
      WHEN lower(state_raw) = 'maine' THEN 'ME'
      WHEN lower(state_raw) = 'maryland' THEN 'MD'
      WHEN lower(state_raw) = 'massachusetts' THEN 'MA'
      WHEN lower(state_raw) = 'michigan' THEN 'MI'
      WHEN lower(state_raw) = 'minnesota' THEN 'MN'
      WHEN lower(state_raw) = 'mississippi' THEN 'MS'
      WHEN lower(state_raw) = 'missouri' THEN 'MO'
      WHEN lower(state_raw) = 'montana' THEN 'MT'
      WHEN lower(state_raw) = 'nebraska' THEN 'NE'
      WHEN lower(state_raw) = 'nevada' THEN 'NV'
      WHEN lower(state_raw) = 'new hampshire' THEN 'NH'
      WHEN lower(state_raw) = 'new jersey' THEN 'NJ'
      WHEN lower(state_raw) = 'new mexico' THEN 'NM'
      WHEN lower(state_raw) = 'new york' THEN 'NY'
      WHEN lower(state_raw) = 'north carolina' THEN 'NC'
      WHEN lower(state_raw) = 'north dakota' THEN 'ND'
      WHEN lower(state_raw) = 'ohio' THEN 'OH'
      WHEN lower(state_raw) = 'oklahoma' THEN 'OK'
      WHEN lower(state_raw) = 'oregon' THEN 'OR'
      WHEN lower(state_raw) = 'pennsylvania' THEN 'PA'
      WHEN lower(state_raw) = 'rhode island' THEN 'RI'
      WHEN lower(state_raw) = 'south carolina' THEN 'SC'
      WHEN lower(state_raw) = 'south dakota' THEN 'SD'
      WHEN lower(state_raw) = 'tennessee' THEN 'TN'
      WHEN lower(state_raw) = 'texas' THEN 'TX'
      WHEN lower(state_raw) = 'utah' THEN 'UT'
      WHEN lower(state_raw) = 'vermont' THEN 'VT'
      WHEN lower(state_raw) = 'virginia' THEN 'VA'
      WHEN lower(state_raw) = 'washington' THEN 'WA'
      WHEN lower(state_raw) = 'west virginia' THEN 'WV'
      WHEN lower(state_raw) = 'wisconsin' THEN 'WI'
      WHEN lower(state_raw) = 'wyoming' THEN 'WY'
      ELSE NULL
    END AS state_code
  FROM normalized
)
UPDATE warehouses w
SET city = CONCAT(m.town, ', ', m.state_code)
FROM mapped m
WHERE w.id = m.id
  AND m.state_code IS NOT NULL;
