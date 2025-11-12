alter table if exists video_comments
  drop constraint if exists country_comments_content_check;

alter table if exists video_comments
  add constraint video_comments_content_check
  check (char_length(content) <= 1000);
