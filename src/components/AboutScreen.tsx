// 앱 안 이용 안내·개인정보 처리 안내·면책
import { cloudEnabled } from '../lib/cloud';
import Glossary from './Glossary';
import FeedbackLink from './FeedbackLink';

export const APP_VERSION = '0.10.0';
export const DATA_BASIS = '2026학년도 학사제도안내';

export default function AboutScreen({ onBack }: { onBack: () => void }) {
  return (
    <section className="about stack">
      <h2>이용 안내</h2>

      <div className="notice">
        <strong>비공식 서비스입니다</strong>
        <span>경희대학교가 만들거나 보증한 서비스가 아닙니다. 결과는 참고용이며, 최종 졸업 판정은 학교 학사정보시스템과 소속 학과 기준을 따릅니다.</span>
      </div>

      <h3>개인정보 처리</h3>
      <ul>
        <li><strong>졸업사정표 파일은 이 기기 브라우저 안에서만 읽습니다.</strong> 서버로 보내거나 저장하지 않으며, 읽은 직후 원문을 버립니다.</li>
        <li>사정표에서 꺼내는 것: 학과명, 입학연도, 과목(학수번호·과목명·학점·학기·이수구분), 영역별 취득/기준 학점, 학점 밖 요건의 충족 여부.</li>
        <li>꺼내지 않는 것: 이름, 학번, 연락처, 성적. 졸업평점은 1.70 기준 충족 여부만 남기고 값은 버립니다.</li>
        <li>꺼낸 내용은 다음 방문 때 이어 보도록 <strong>이 기기의 브라우저 저장소</strong>에만 저장됩니다. 처음 화면의 '내 데이터 모두 삭제'로 언제든 지울 수 있고, 사정표를 올릴 때 '공용 PC예요'를 고르면 아예 저장하지 않습니다.</li>
        <li>앱은 브라우저 보안 정책(CSP)으로 외부 주소에 데이터를 보낼 수 없게 막혀 있습니다.</li>
        {cloudEnabled
          ? <li>로그인한 경우에만, 위 내용이 계정에 동기화됩니다. 계정 화면에서 서버 데이터 삭제·탈퇴가 가능합니다.</li>
          : <li>이 앱은 로그인이 없고, 분석·광고용 추적 도구를 쓰지 않습니다.</li>}
      </ul>

      <h3>계산 기준</h3>
      <ul>
        <li>남은 학점과 영역별 기준은 사정표에 적힌 학교 집계를 그대로 씁니다.</li>
        <li>이수구분 코드, 졸업요건, 다전공·마이크로디그리 규정은 {DATA_BASIS}를 따릅니다.</li>
        <li>과목 추천·로드맵은 학과 교육과정 데이터가 있는 학과에서만 제공합니다: 산업경영공학과(2025 교육과정), 컴퓨터공학과(2024), 경영학과(2026).</li>
        <li>다전공 학점은 2026 학사제도안내의 전공별 기본구조표(서울·국제 120여 개 전공), 수강허용학점은 같은 책 64쪽 표를 씁니다.</li>
        <li>학과 교육과정 원문이 이미지로만 올라온 해(예: 산업경영공학과 2026)는 가장 가까운 연도 표를 쓰고 화면에 알립니다.</li>
      </ul>

      <h3>용어</h3>
      <Glossary open />

      <h3>의견·오류 제보</h3>
      <p>계산이 사정표와 다르거나 읽기에 실패하면, 사정표 화면의 '제보하기'에서 내용을 가린 표 모양을 복사해 보내 주세요. <FeedbackLink /></p>

      <p className="muted">버전 {APP_VERSION} · 데이터 기준 {DATA_BASIS}</p>
      <div className="actions"><button type="button" onClick={onBack}>돌아가기</button></div>
    </section>
  );
}
