// 앱 안 이용 안내·개인정보 처리 안내·면책
import { cloudEnabled } from '../lib/cloud';
import Glossary from './Glossary';
import FeedbackLink from './FeedbackLink';

export const APP_VERSION = '0.19.3';
export const DATA_BASIS = '2026학년도 학사제도안내';

export default function AboutScreen({ onBack }: { onBack: () => void }) {
  return (
    <section className="about stack">
      <h2>이용 안내</h2>

      <details className="acc" open>
        <summary><strong>비공식 안내</strong><span className="muted">학교가 만든 서비스가 아니에요</span></summary>
        <p>경희대학교가 만들거나 보증한 서비스가 아닙니다. 결과는 참고용이며, 최종 졸업 판정은 학교 학사정보시스템과 소속 학과 기준을 따릅니다.</p>
        <p className="muted">경희대학교 휘장과 전용 색상은 교무처의 사용 허가를 받아 사용했습니다.</p>
      </details>

      <details className="acc">
        <summary><strong>개인정보</strong><span className="muted">사정표 파일은 내 기기 안에서만 읽어요</span></summary>
        <ul>
          <li><strong>졸업사정표 파일은 이 기기 브라우저 안에서만 읽습니다.</strong> 서버로 보내거나 저장하지 않으며, 읽은 직후 원문을 버립니다.</li>
          <li>꺼내는 것: 학과명, 입학연도, 과목(학수번호·과목명·학점·학기·이수구분), 영역별 학점, 학점 밖 요건의 충족 여부.</li>
          <li>꺼내지 않는 것: 이름, 학번, 연락처, 성적. 졸업평점은 1.70 기준 충족 여부만 남깁니다.</li>
          <li>게스트는 <strong>이 기기의 브라우저 저장소</strong>에만 저장합니다. '공용 PC예요'를 고르면 저장하지 않습니다.</li>
          <li>브라우저 보안 정책(CSP)으로 정해진 주소 외에는 데이터를 보낼 수 없습니다.</li>
          {cloudEnabled
            ? <li>로그인한 경우에만 위 내용이 계정에 동기화됩니다. 계정 화면에서 서버 데이터 삭제·탈퇴가 가능합니다.</li>
            : <li>분석·광고용 추적 도구를 쓰지 않습니다.</li>}
        </ul>
      </details>

      <details className="acc">
        <summary><strong>계산 기준</strong><span className="muted">학교 집계와 {DATA_BASIS}를 따라요</span></summary>
        <p>남은 학점과 영역별 기준은 사정표의 학교 집계를 그대로 씁니다. 교육과정 데이터가 있는 학과만 과목 추천을 제공해요.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>캠퍼스</th><th>범위</th><th>기준 연도</th></tr></thead>
            <tbody>
              <tr><td>국제</td><td>전 학과·융합전공</td><td>2026 교육과정 책자</td></tr>
              <tr><td>서울</td><td>40개 학과·전공</td><td>2026 시행세칙 (일부 2023~2025)</td></tr>
              <tr><td>공통</td><td>다전공 학점·수강허용학점</td><td>{DATA_BASIS} 기본구조표·64쪽</td></tr>
              <tr><td>공통</td><td>교양 (후마니타스칼리지)</td><td>2026 교양교육과정 · 485과목</td></tr>
            </tbody>
          </table>
        </div>
        <details className="acc-inner">
          <summary>계산 근거 보기</summary>
          <ul>
            <li>이수구분 코드, 졸업요건, 다전공·마이크로디그리 규정은 {DATA_BASIS}를 따릅니다.</li>
            <li>무역학과·국제통상금융투자학부·회계세무·빅데이터응용·음악대학·간호학과(학수번호 없음) 등은 원문을 받는 대로 추가합니다.</li>
            <li>원문이 이미지로만 올라온 해(예: 산업경영공학과 2026)는 가장 가까운 연도 표를 쓰고 화면에 알립니다.</li>
            <li>다음 학기 추천은 전공필수·남은 영역 학점·선수과목·권장 학년·개설 학기·관심 다전공을 점수로 매겨 고릅니다.</li>
          </ul>
        </details>
      </details>

      <details className="acc">
        <summary><strong>용어</strong><span className="muted">전기·전필·배분이수 같은 말 풀이</span></summary>
        <Glossary open />
      </details>

      <details className="acc">
        <summary><strong>제보</strong><span className="muted">계산이 다르면 알려 주세요</span></summary>
        <p>사정표와 다르거나 읽기에 실패하면, 사정표 화면의 '제보하기'에서 내용을 가린 표 모양을 복사해 보내 주세요. <FeedbackLink /></p>
      </details>

      <p className="muted">버전 {APP_VERSION} · 데이터 기준 {DATA_BASIS}</p>
      <div className="actions"><button type="button" onClick={onBack}>돌아가기</button></div>
    </section>
  );
}
