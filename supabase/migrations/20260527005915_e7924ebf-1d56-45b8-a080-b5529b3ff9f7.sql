DO $$
DECLARE
  del_ids text[] := ARRAY['banglore_day','banglore_morning','banglore_night','bombay_day','central_mumbai','jay_shree_day','kalyan_sridevi','kalyan_sridevi_night','karnataka_day','kuber_morning','lucky_day','maharani','maharani_day','maharani_night','meena_bazar_day','morning_market','mumbai_day','padmavathi','padmavathi_night','parel_day','shri_devi_day','sri_dhanalaxmi','star_tara_day','star_tara_morning','star_tara_night','sunday_bazar','super_goa_day','worli_night'];
  keep_ids text[] := ARRAY['ratan_khatri','bombay_night'];
BEGIN
  DELETE FROM public.market_alert_preferences WHERE market_id = ANY(del_ids);
  DELETE FROM public.market_automation        WHERE market_id = ANY(del_ids);
  DELETE FROM public.market_source_map        WHERE market_id = ANY(del_ids);
  DELETE FROM public.market_results           WHERE market_id = ANY(del_ids);
  DELETE FROM public.markets                  WHERE id        = ANY(del_ids);

  UPDATE public.markets SET status = 'INACTIVE' WHERE id = ANY(keep_ids);
END $$;