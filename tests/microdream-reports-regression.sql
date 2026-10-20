begin;
do $$
declare staff_id uuid; rid uuid:=gen_random_uuid(); request text:=gen_random_uuid()::text||':QA'; r jsonb; original jsonb; result jsonb; denied boolean:=false; edits jsonb; before_edit jsonb;
begin
 select user_id into staff_id from public.apex_staff where active=true limit 1;
 if staff_id is null then raise exception 'No test staff identity available';end if;
 perform set_config('request.jwt.claim.sub',staff_id::text,true);
 r:=jsonb_build_object('id',rid,'requestKey',request,'palletName','QA-MD','palletCreatedAt','QA-REPORT-TEST','createdAt',now(),'updatedAt',now(),'revision',1,'assetIds',jsonb_build_array('QA-1'),'document',jsonb_build_object('jobRef','','total',1,'rows',jsonb_build_array(jsonb_build_object('model','Dell Test','type','Laptop','quantity',1,'language','Reprint UK','comment','Full respray'))));
 result:=public.apex_microdream_report_action(jsonb_build_object('action','create','reports',jsonb_build_array(r)));
 if not (result->>'ok')::boolean then raise exception 'Create failed';end if;
 perform public.apex_microdream_report_action(jsonb_build_object('action','create','reports',jsonb_build_array(r)));
 if (select count(*) from public.apex_microdream_reports where request_key=request)<>1 then raise exception 'Retry duplicated report';end if;
 original:=result->'reports'->0->'document'->'rows';
 result:=public.apex_microdream_report_action(jsonb_build_object('action','update','id',rid,'expectedRevision',1,'jobRef','MD-REF-UPDATED'));
 if result->'report'->'document'->>'jobRef'<>'MD-REF-UPDATED' or result->'report'->'document'->'rows'<>original then raise exception 'Reference changed report snapshot';end if;
 result:=public.apex_microdream_report_action(jsonb_build_object('action','get','id',rid));
 if result->'report'->'document'->>'jobRef'<>'MD-REF-UPDATED' then raise exception 'Reopened reference not saved';end if;
 begin
  perform public.apex_microdream_report_action(jsonb_build_object('action','update','id',rid,'expectedRevision',1,'jobRef','STALE'));
 exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Stale overwrite accepted';end if;
 result:=public.apex_microdream_report_action(jsonb_build_object('action','list','pallet',jsonb_build_object('name','RENAMED-QA-MD','createdAt','QA-REPORT-TEST')));
 if not exists(select 1 from jsonb_array_elements(result->'reports') x where x->>'id'=rid::text) then raise exception 'Rename lost report';end if;
 before_edit:=(public.apex_microdream_report_action(jsonb_build_object('action','get','id',rid)))->'report';
 edits:=jsonb_build_object('jobRef','KEYBOARD-ONLY','rows',jsonb_build_array(jsonb_build_object('type','Notebook','model','Dell Test UK','language','UK keyboard only','comment','Keyboard spray','quantity','2','received','1')));
 result:=public.apex_microdream_report_action(jsonb_build_object('action','update','id',rid,'expectedRevision',2,'edits',edits));
 if result->'report'->'document'->'rows'->0->>'comment'<>'Keyboard spray' or result->'report'->'document'->>'total'<>'2' or result->'report'->'document'->'rows'->0->>'received'<>'1' then raise exception 'Inline report edits not saved';end if;
 if result->'report'->'assetIds'<>before_edit->'assetIds' or result->'report'->>'requestKey'<>before_edit->>'requestKey' then raise exception 'Inline edits altered report identity';end if;
 result:=public.apex_microdream_report_action(jsonb_build_object('action','get','id',rid));
 if result->'report'->'document'->'rows'->0->>'language'<>'UK keyboard only' then raise exception 'Reopened edits lost';end if;
 denied:=false;
 begin perform public.apex_microdream_report_action(jsonb_build_object('action','update','id',rid,'expectedRevision',3,'edits',jsonb_set(edits,'{rows,0,quantity}','"-1"')));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Negative quantity accepted';end if;
 denied:=false;
 begin perform public.apex_microdream_report_action(jsonb_build_object('action','update','id',rid,'expectedRevision',3,'edits',jsonb_set(edits,'{rows,0,comment}',to_jsonb(repeat('x',201)))));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Oversized comment accepted';end if;
 denied:=false;
 begin perform public.apex_microdream_report_action(jsonb_build_object('action','update','id',rid,'expectedRevision',3,'edits',jsonb_set(edits,'{rows}','[]')));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Row deletion accepted';end if;
 result:=public.apex_microdream_report_action(jsonb_build_object('action','update','id',rid,'expectedRevision',3,'jobRef','OLDER-CLIENT-REF'));
 if result->'report'->'document'->'rows'->0->>'comment'<>'Keyboard spray' then raise exception 'Older client overwrote edited fields';end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);denied:=false;
 begin perform public.apex_microdream_report_action(jsonb_build_object('action','get','id',rid));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Non-staff read allowed';end if;
 if has_function_privilege('anon','public.apex_microdream_report_action(jsonb)','execute') then raise exception 'Anonymous RPC access';end if;
 if has_table_privilege('authenticated','public.apex_microdream_reports','update') then raise exception 'Direct snapshot edits allowed';end if;
end $$;
rollback;

