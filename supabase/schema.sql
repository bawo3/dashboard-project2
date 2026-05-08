-- 스크래핑 설정 테이블
-- 어떤 URL에서, 어떤 버튼을 누르고, 얼마나 자주 수집할지 정의
CREATE TABLE scraper_configs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url             text NOT NULL,
  button_selector text NOT NULL,
  schedule        text NOT NULL DEFAULT 'manual',
  created_at      timestamptz DEFAULT now()
);

-- 입력 필드 목록 테이블
-- 로그인 폼 등 수집 전 입력이 필요한 필드와 그 값을 저장
CREATE TABLE scraper_fields (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id       uuid REFERENCES scraper_configs(id) ON DELETE CASCADE,
  field_selector  text NOT NULL,
  field_value     text NOT NULL
);

-- 수집된 문의 데이터 테이블
-- IT 시스템별 주간 문의 건수를 저장
CREATE TABLE inquiry_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id     uuid REFERENCES scraper_configs(id),
  system_name   text NOT NULL,
  count         integer NOT NULL,
  collected_at  timestamptz DEFAULT now()
);

-- 수집 실행 로그 테이블
-- 스크래핑 실행 결과(성공/실패)와 메시지를 기록
CREATE TABLE collection_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id   uuid REFERENCES scraper_configs(id),
  status      text NOT NULL,
  message     text,
  executed_at timestamptz DEFAULT now()
);
