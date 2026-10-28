// 결과 공유 카드: 이름·학번 없이 '남은 학점·영역 막대'만 그린 이미지를 만든다.
// 이미지는 이 기기에서 그리며, 공유·저장은 사용자가 고른 앱으로만 나간다.
import { useEffect, useRef, useState } from 'react';

export interface ShareBar { name: string; earned: number; required: number }

interface Props {
  title: string;        // 예: "산업경영공학과 2025학번"
  headline: string;     // 예: "졸업까지 75학점이 남았습니다"
  bars: ShareBar[];
  footnote?: string;
}

const W = 1080, H = 1350;

function draw(ctx: CanvasRenderingContext2D, p: Props) {
  const font = (w: number, size: number) => `${w} ${size}px "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  ctx.fillStyle = '#FBF7EE';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#A40F16';
  ctx.fillRect(0, 0, W, 16);

  ctx.fillStyle = '#5F5A5B';
  ctx.font = font(500, 34);
  ctx.fillText('졸업요건 계산기', 80, 110);
  ctx.fillStyle = '#2A2022';
  ctx.font = font(600, 40);
  ctx.fillText(p.title, 80, 170);

  // 결론 (길면 두 줄로)
  ctx.font = font(700, 64);
  ctx.fillStyle = '#A40F16';
  const words = p.headline.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > W - 160 && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, 80, 290 + i * 80));

  let y = 290 + Math.min(3, lines.length) * 80 + 40;
  for (const b of p.bars.slice(0, 8)) {
    const rate = b.required ? Math.min(1, b.earned / b.required) : 0;
    ctx.fillStyle = '#2A2022';
    ctx.font = font(600, 34);
    ctx.fillText(b.name, 80, y);
    ctx.fillStyle = '#5F5A5B';
    ctx.font = font(500, 32);
    const fig = `${b.earned} / ${b.required}`;
    ctx.fillText(fig, W - 80 - ctx.measureText(fig).width, y);
    ctx.fillStyle = '#E2D7C0';
    ctx.fillRect(80, y + 18, W - 160, 22);
    ctx.fillStyle = rate >= 1 ? '#2F6B3B' : '#A40F16';
    ctx.fillRect(80, y + 18, (W - 160) * rate, 22);
    y += 100;
  }

  ctx.fillStyle = '#5F5A5B';
  ctx.font = font(400, 26);
  ctx.fillText(p.footnote ?? '졸업사정표 기준 · 비공식 참고용', 80, H - 90);
  ctx.fillText('이름·학번·성적은 들어 있지 않습니다', 80, H - 50);
}

export default function ShareCard(p: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [msg, setMsg] = useState('');
  const urlRef = useRef<string | null>(null);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const make = () => {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setMsg('이 브라우저에서는 이미지를 만들 수 없습니다.'); return; }
    draw(ctx, p);
    canvas.toBlob((b) => {
      if (!b) { setMsg('이미지를 만들지 못했습니다.'); return; }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const u = URL.createObjectURL(b);
      urlRef.current = u;
      setBlob(b); setUrl(u); setMsg('');
    }, 'image/png');
  };

  const share = async () => {
    if (!blob) return;
    const file = new File([blob], 'graduation-card.png', { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: '졸업요건 현황' });
        return;
      }
    } catch { /* 사용자가 취소 */ return; }
    setMsg('이 기기에서는 바로 공유할 수 없어요. 이미지 저장을 눌러 주세요.');
  };

  return (
    <div className="share-card">
      {!url ? (
        <button type="button" onClick={make}>공유 카드 만들기</button>
      ) : (
        <>
          <img src={url} alt={`${p.title} 졸업요건 공유 카드: ${p.headline}`} className="share-preview" />
          <div className="actions">
            <button type="button" className="primary" onClick={share}>공유</button>
            <a className="button-like" href={url} download="graduation-card.png">이미지 저장</a>
            <button type="button" className="link" onClick={make}>다시 만들기</button>
          </div>
        </>
      )}
      {msg && <p className="muted" role="status">{msg}</p>}
    </div>
  );
}
