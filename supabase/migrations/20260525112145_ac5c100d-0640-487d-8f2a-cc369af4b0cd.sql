
-- 1. is_core column
ALTER TABLE public.markets ADD COLUMN IF NOT EXISTS is_core boolean NOT NULL DEFAULT false;

-- Backfill: current 13 markets are core
UPDATE public.markets SET is_core = true
WHERE id IN (
  'kalyan','kalyan_night','milan_day','milan_night','rajdhani_day','rajdhani_night',
  'main_bazar','main_mumbai','time_bazar','sridevi','sridevi_night','madhur_day','madhur_night'
);

-- 2. Seed new markets (ON CONFLICT DO NOTHING preserves existing rows)
WITH default_payouts AS (
  SELECT '{"single":9,"jodi":90,"singlePana":150,"doublePana":300,"triplePana":600,"halfSangam":1000,"fullSangam":10000}'::jsonb AS p
),
new_markets(id, display_name, open_time, close_time, result_time, is_core) AS (
  VALUES
  -- Matka markets
  ('kalyan_morning',       'Kalyan Morning',       '11:00','12:00','12:15', true),
  ('super_kalyan',         'Super Kalyan',         '14:00','15:00','15:15', true),
  ('rajdhani_morning',     'Rajdhani Morning',     '09:30','10:30','10:45', true),
  ('puna_night',           'Puna Night',           '20:00','22:00','22:15', true),

  ('milan_morning',        'Milan Morning',        '10:15','11:15','11:30', false),
  ('madhuri',              'Madhuri',              '11:30','12:30','12:45', false),
  ('sridevi_morning',      'Sridevi Morning',      '09:45','10:45','11:00', false),
  ('maharani',             'Maharani',             '12:00','13:00','13:15', false),
  ('karnataka_day',        'Karnataka Day',        '14:30','16:30','16:45', false),
  ('time_bazar_morning',   'Time Bazar Morning',   '10:55','11:55','12:10', false),
  ('main_sridevi_day',     'Main Sridevi Day',     '11:35','12:35','12:50', false),
  ('tara_mumbai_day',      'Tara Mumbai Day',      '13:30','15:00','15:15', false),
  ('prabhat',              'Prabhat',              '10:15','11:15','11:30', false),
  ('diamond',              'Diamond',              '11:50','12:50','13:05', false),
  ('time_bazar_day',       'Time Bazar Day',       '13:00','14:00','14:15', false),
  ('main_bazar_morning',   'Main Bazar Morning',   '11:00','13:00','13:15', false),
  ('main_bazar_day',       'Main Bazar Day',       '15:00','17:00','17:15', false),
  ('puna_bazar',           'Puna Bazar',           '13:35','14:35','14:50', false),
  ('new_time_bazar',       'New Time Bazar',       '12:35','13:35','13:50', false),
  ('diamond_night',        'Diamond Night',        '20:50','22:50','23:05', false),
  ('madhuri_night',        'Madhuri Night',        '21:30','23:30','23:45', false),
  ('night_time_bazar',     'Night Time Bazar',     '20:30','22:30','22:45', false),
  ('tara_mumbai_night',    'Tara Mumbai Night',    '20:30','22:30','22:45', false),
  ('banglore_morning',     'Banglore Morning',     '10:00','11:00','11:15', false),
  ('banglore_day',         'Banglore Day',         '14:00','16:00','16:15', false),
  ('banglore_night',       'Banglore Night',       '20:00','22:00','22:15', false),
  ('main_sridevi',         'Main Sridevi',         '20:30','22:30','22:45', false),
  ('maharani_day',         'Maharani Day',         '12:30','13:30','13:45', false),
  ('parel_day',            'Parel Day',            '14:00','16:00','16:15', false),
  ('bombay_day',           'Bombay Day',           '14:30','16:30','16:45', false),
  ('shri_devi_day',        'Shri Devi Day',        '11:00','12:00','12:15', false),
  ('ratan_khatri',         'Ratan Khatri',         '20:00','22:00','22:15', false),
  ('morning_market',       'Morning',              '09:00','10:00','10:15', false),
  ('worli_night',          'Worli Night',          '21:30','23:30','23:45', false),
  ('maharani_night',       'Maharani Night',       '21:30','23:00','23:15', false),
  ('jay_shree_day',        'Jay Shree Day',        '13:30','15:00','15:15', false),
  ('sri_dhanalaxmi',       'Sri Dhanalaxmi',       '14:00','16:00','16:15', false),
  ('bombay_night',         'Bombay Night',         '21:30','23:30','23:45', false),
  ('sunday_bazar',         'Sunday Bazar',         '14:00','16:00','16:15', false),
  ('padmavathi',           'Padmavathi',           '13:00','14:00','14:15', false),
  ('padmavathi_night',     'Padmavathi Night',     '20:30','22:30','22:45', false),
  ('lucky_day',            'Lucky Day',            '13:00','14:00','14:15', false),
  ('kalyan_sridevi',       'Kalyan Sridevi',       '13:30','15:30','15:45', false),
  ('kalyan_sridevi_night', 'Kalyan Sridevi Night', '21:00','23:00','23:15', false),
  ('central_mumbai',       'Central Mumbai',       '15:00','17:00','17:15', false),
  ('super_goa_day',        'Super Goa Day',        '14:30','16:30','16:45', false),
  ('kuber_morning',        'Kuber Morning',        '09:30','10:30','10:45', false),
  ('mumbai_day',           'Mumbai Day',           '14:00','16:00','16:15', false),
  ('meena_bazar_day',      'Meena Bazar Day',      '14:30','16:30','16:45', false),
  ('star_tara_morning',    'Star Tara Morning',    '10:30','11:30','11:45', false),
  ('star_tara_day',        'Star Tara Day',        '14:30','16:30','16:45', false),
  ('star_tara_night',      'Star Tara Night',      '21:30','23:30','23:45', false),

  -- Jodi markets (single result; use open=result_time-15m, close=result_time)
  ('gali',         'Gali',          '23:15','23:30','23:30', false),
  ('disawar',      'Disawar',       '04:45','05:00','05:00', false),
  ('ghaziabad',    'Ghaziabad',     '21:15','21:30','21:30', false),
  ('faridabad',    'Faridabad',     '18:15','18:30','18:30', false),
  ('mohali',       'Mohali',        '18:15','18:30','18:30', false),
  ('delhi_bazar',  'Delhi Bazar',   '14:45','15:00','15:00', false),
  ('shri_ganesh',  'Shri Ganesh',   '16:15','16:30','16:30', false),
  ('rajdhani_jodi','Rajdhani Jodi', '14:45','15:00','15:00', false)
)
INSERT INTO public.markets (id, name, display_name, open_time, close_time, result_time, days, status, min_bet, max_bet, payouts, is_core)
SELECT
  nm.id, nm.display_name, nm.display_name,
  nm.open_time, nm.close_time, nm.result_time,
  ARRAY['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'ACTIVE', 10, 10000, dp.p, nm.is_core
FROM new_markets nm CROSS JOIN default_payouts dp
ON CONFLICT (id) DO NOTHING;

-- 3. Seed source map (dpboss primary + sattamatkadpboss backup) for markets
--    that exist on those sites.
INSERT INTO public.market_source_map (market_id, source, slug, enabled)
VALUES
  -- Matka markets present on dpboss
  ('kalyan_morning','dpboss','kalyan-morning',true),
  ('kalyan_morning','sattamatkadpboss','kalyan-morning',true),
  ('super_kalyan','dpboss','super-kalyan',true),
  ('super_kalyan','sattamatkadpboss','super-kalyan',true),
  ('rajdhani_morning','dpboss','rajdhani-morning',true),
  ('rajdhani_morning','sattamatkadpboss','rajdhani-morning',true),
  ('milan_morning','dpboss','milan-morning',true),
  ('milan_morning','sattamatkadpboss','milan-morning',true),
  ('madhuri','dpboss','madhuri',true),
  ('madhuri','sattamatkadpboss','madhuri',true),
  ('sridevi_morning','dpboss','sridevi-morning',true),
  ('sridevi_morning','sattamatkadpboss','sridevi-morning',true),
  ('time_bazar_morning','dpboss','time-bazar-morning',true),
  ('time_bazar_morning','sattamatkadpboss','time-bazar-morning',true),
  ('time_bazar_day','dpboss','time-bazar-day',true),
  ('time_bazar_day','sattamatkadpboss','time-bazar-day',true),
  ('main_sridevi_day','dpboss','main-sridevi-day',true),
  ('main_sridevi_day','sattamatkadpboss','main-sridevi-day',true),
  ('main_sridevi','dpboss','main-sridevi',true),
  ('main_sridevi','sattamatkadpboss','main-sridevi',true),
  ('tara_mumbai_day','dpboss','tara-mumbai-day',true),
  ('tara_mumbai_day','sattamatkadpboss','tara-mumbai-day',true),
  ('tara_mumbai_night','dpboss','tara-mumbai-night',true),
  ('tara_mumbai_night','sattamatkadpboss','tara-mumbai-night',true),
  ('prabhat','dpboss','prabhat',true),
  ('prabhat','sattamatkadpboss','prabhat',true),
  ('diamond','dpboss','diamond',true),
  ('diamond','sattamatkadpboss','diamond',true),
  ('diamond_night','dpboss','diamond-night',true),
  ('diamond_night','sattamatkadpboss','diamond-night',true),
  ('main_bazar_morning','dpboss','main-bazar-morning',true),
  ('main_bazar_morning','sattamatkadpboss','main-bazar-morning',true),
  ('main_bazar_day','dpboss','main-bazar-day',true),
  ('main_bazar_day','sattamatkadpboss','main-bazar-day',true),
  ('madhuri_night','dpboss','madhuri-night',true),
  ('madhuri_night','sattamatkadpboss','madhuri-night',true),
  ('night_time_bazar','dpboss','night-time-bazar',true),
  ('night_time_bazar','sattamatkadpboss','night-time-bazar',true),
  ('new_time_bazar','dpboss','new-time-bazar',true),
  ('new_time_bazar','sattamatkadpboss','new-time-bazar',true),
  ('puna_bazar','dpboss','puna-bazar',true),
  ('puna_bazar','sattamatkadpboss','puna-bazar',true),
  ('puna_night','dpboss','puna-night',true),
  ('puna_night','sattamatkadpboss','puna-night',true),

  -- Jodi markets via galidisawar
  ('gali','galidisawar','gali',true),
  ('disawar','galidisawar','disawar',true),
  ('ghaziabad','galidisawar','ghaziabad',true),
  ('faridabad','galidisawar','faridabad',true),
  ('mohali','galidisawar','mohali',true),
  ('delhi_bazar','galidisawar','delhi-bazar',true),
  ('shri_ganesh','galidisawar','shri-ganesh',true),
  ('rajdhani_jodi','galidisawar','rajdhani',true)
ON CONFLICT DO NOTHING;

-- 4. Seed automation rows
-- Markets with any source map row -> auto-enabled RANDOM with 2min grace
-- Markets without source -> MANUAL, disabled
INSERT INTO public.market_automation (market_id, open_enabled, close_enabled, mode, grace_minutes)
SELECT
  m.id,
  CASE WHEN s.market_id IS NOT NULL THEN true ELSE false END,
  CASE WHEN s.market_id IS NOT NULL THEN true ELSE false END,
  CASE WHEN s.market_id IS NOT NULL THEN 'RANDOM' ELSE 'MANUAL' END,
  2
FROM public.markets m
LEFT JOIN (SELECT DISTINCT market_id FROM public.market_source_map) s ON s.market_id = m.id
ON CONFLICT (market_id) DO NOTHING;
