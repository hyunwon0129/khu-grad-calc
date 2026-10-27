// 의견 보내기 자리. 설문 주소(구글폼 등)가 정해지면 FEEDBACK_URL에 넣으면 버튼이 켜진다.
// 주소가 비어 있으면 '준비 중'으로만 보인다. (외부로 데이터를 보내지 않고, 새 창으로 링크만 연다)
export const FEEDBACK_URL = '';

export default function FeedbackLink() {
  if (!FEEDBACK_URL) {
    return <span className="muted" title="의견 창구를 준비하고 있습니다">의견 보내기(준비 중)</span>;
  }
  return <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">의견 보내기</a>;
}
