-- Add the narrow single-column 'checkup' landing template.
-- Without this the admin dropdown offers it and saving fails the CHECK.
-- Apply to STAGING (fxdsnacuonfvutdquogb) first, then Lifestyle (rvwseybgimmewuoccecu).

alter table gema.ginhawa_landing
  drop constraint if exists ginhawa_landing_template_check;

alter table gema.ginhawa_landing
  add constraint ginhawa_landing_template_check
  check (template in ('medical', 'checkup', 'sizzle', 'session'));
