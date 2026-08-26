-- Point the Ginhawa Book CTA at the public registration form, not the invite page.
--
-- Apply to STAGING (fxdsnacuonfvutdquogb) first, then Lifestyle (rvwseybgimmewuoccecu).

update gema.ginhawa_landing
set book_url = regexp_replace(book_url, '/invite/([0-9a-f-]{36})$', '/register/\1', 'i')
where book_url ~* '/invite/[0-9a-f-]{36}$';

update gema.ginhawa_landing
set book_url = 'https://gema-ivory.vercel.app/register/' || source_event_id::text
where book_url is null
  and source_event_id is not null;
