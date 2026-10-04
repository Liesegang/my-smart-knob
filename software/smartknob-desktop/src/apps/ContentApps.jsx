import React, { useEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import { APP_IDS, APP_INFO } from '../model.js';
import { BROWSER_TABS, READER_CHAPTERS, READER_PAGES, REVIEW_FILES } from '../content.js';
import { Glyph, setValue } from './shared.jsx';

export function BrowserApp({ state, dispatch }) {
  const [checked, setChecked] = useState([]);
  const current = BROWSER_TABS[state.activeTab];
  const selected = BROWSER_TABS[state.tabIndex];
  const openTab = (index) => {
    setValue(dispatch, 'browser', 'tabIndex', index);
    setValue(dispatch, 'browser', 'activeTab', index);
  };
  return <div className="app-browser">
    <nav className="app-browser-tabs" aria-label="ブラウザのタブ">{BROWSER_TABS.map((tab, index) => <button key={tab.id} className={`${state.activeTab === index ? 'is-open' : ''} ${state.tabIndex === index ? 'is-selected' : ''}`} onClick={() => openTab(index)} aria-current={state.activeTab === index ? 'page' : undefined}><span className={`app-tab-dot app-tab-${tab.type}`} /><span>{tab.title}</span><small>{index + 1}</small></button>)}</nav>
    <div className="app-browser-address"><span className="app-local-label">ローカル</span><span>{current.url}</span><span className="app-browser-page-count">{state.activeTab + 1} / {BROWSER_TABS.length}</span></div>
    <div className={`app-browser-selection ${state.tabIndex !== state.activeTab ? 'is-pending' : ''}`}>
      {state.tabIndex !== state.activeTab ? <><span>選択中：<strong>{selected.title}</strong></span><button className="app-primary-button" onClick={() => dispatch({ type: 'press', app: 'browser' })}>このタブを開く <span>↵</span></button></> : <span>ノブを回してタブを選び、押して開きます。</span>}
    </div>
    <article className={`app-browser-page app-browser-${current.type}`}>
      <div className="app-fieldnotes-brand">FIELD NOTES <span>散歩と日々の記録</span></div>
      <p className="app-overline">{current.type === 'article' ? 'JOURNAL / 01' : current.type === 'gallery' ? 'PHOTOGRAPHS / 02' : current.type === 'schedule' ? 'WEEKEND / 03' : 'CHECKLIST / 04'}</p>
      <h1>{current.heading}</h1>
      {current.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {current.type === 'gallery' ? <figure className="app-browser-photo"><img src="/coast.png" alt="夕暮れの海岸の写真" /><figcaption>海岸の夕暮れ · coast.png</figcaption></figure> : null}
      <div className={`app-browser-items app-browser-items-${current.type}`}>{current.items.map((item, index) => current.type === 'notes' ? <label key={item.title} className={checked.includes(index) ? 'is-checked' : ''}><input type="checkbox" checked={checked.includes(index)} onChange={() => setChecked((items) => items.includes(index) ? items.filter((n) => n !== index) : [...items, index])} /><span><strong>{item.title}</strong><small>{item.detail}</small></span></label> : <div key={item.title}>{item.time ? <time>{item.time}</time> : null}{item.color ? <span className="app-note-color" style={{ background: item.color }} /> : null}<span><strong>{item.title}</strong><small>{item.detail}</small></span></div>)}</div>
      <footer className="app-fieldnotes-footer">FIELD NOTES <span>端末内のサンプルページ</span></footer>
    </article>
  </div>;
}

const FAVORITES = ['photo', 'timer', 'music'];
export function WindowsApp({ state, dispatch, onOpen }) {
  const selectedId = APP_IDS[state.index];
  const selected = APP_INFO[selectedId];
  return <div className="app-switcher">
    <div className="app-switcher-header"><p>アプリを選択</p><span>★ のアプリではクリックが少し強くなります。</span></div>
    <div className="app-switcher-grid">{APP_IDS.map((id, index) => <button key={id} className={state.index === index ? 'is-selected' : ''} onClick={() => setValue(dispatch, 'windows', 'index', index)} onDoubleClick={() => onOpen(id)} aria-pressed={state.index === index}><Icon id={id} size={44} /><span>{APP_INFO[id].name}</span>{FAVORITES.includes(id) ? <span className="app-favorite" title="強めのクリック">★</span> : null}</button>)}</div>
    <div className="app-switcher-footer"><span><strong>{selected.name}</strong>{FAVORITES.includes(selectedId) ? <small>よく使うアプリ</small> : null}</span><button className="app-primary-button" onClick={() => onOpen(selectedId)}>開く <span>↵</span></button></div>
  </div>;
}

export function ReviewApp({ state, dispatch }) {
  const selectedRef = useRef(null);
  const file = REVIEW_FILES[state.file];
  useEffect(() => { selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [state.file, state.hunk]);
  function toggle(index) {
    setValue(dispatch, 'review', 'hunk', index);
    dispatch({ type: 'press', app: 'review' });
  }
  return <div className="app-review">
    <aside className="app-review-files"><div className="app-sidebar-label">変更したファイル <span>3</span></div>{REVIEW_FILES.map((entry, index) => <button key={entry.path} className={state.file === index ? 'is-selected' : ''} onClick={() => setValue(dispatch, 'review', 'file', index)}><span className="app-file-language">{entry.language === 'javascript' ? 'JS' : entry.language === 'css' ? '#' : 'M↓'}</span><span>{entry.path}</span><small>{entry.hunks.length}</small></button>)}<p>ノブを押す：展開<br />長押し：次のファイル</p></aside>
    <div className="app-review-main"><header><strong>{file.path}</strong><span>{file.hunks.length} 箇所の変更</span></header><div className="app-review-hunks">{file.hunks.map((hunk, index) => {
      const expanded = state.expanded.includes(`${state.file}:${index}`);
      return <section key={`${state.file}:${index}`} ref={state.hunk === index ? selectedRef : null} className={`app-diff-hunk ${state.hunk === index ? 'is-selected' : ''}`}>
        <button className="app-diff-heading" aria-expanded={expanded} onClick={() => toggle(index)}><Glyph name="chevron" size={13} style={{ transform: expanded ? 'rotate(90deg)' : undefined }} /><span><strong>{hunk.title}</strong><small>@@ −{hunk.oldStart} +{hunk.newStart} @@</small></span><span className="app-diff-count"><b>+{hunk.lines.filter((line) => line.type === 'add').length}</b><i>−{hunk.lines.filter((line) => line.type === 'remove').length}</i></span></button>
        {expanded ? <div className="app-diff-code">{hunk.lines.map((line, lineIndex) => <div key={lineIndex} className={`app-code-${line.type}`}><span className="app-code-number">{line.type === 'remove' ? '−' : hunk.newStart + lineIndex}</span><span className="app-code-prefix">{line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}</span><code>{line.text}</code></div>)}</div> : <button className="app-diff-preview" onClick={() => toggle(index)}>{hunk.lines.length} 行の差分を表示</button>}
      </section>;
    })}</div><footer><span>選択中：{state.hunk + 1} / {file.hunks.length}</span><button className="app-plain-button" onClick={() => dispatch({ type: 'longPress', app: 'review' })}>次のファイル →</button></footer></div>
  </div>;
}

function CoffeeFigure() {
  return <svg className="app-coffee-figure" viewBox="0 0 180 130" fill="none" aria-label="ドリッパーからカップに落ちるコーヒーの図"><path d="M42 24h94L106 64H72Z" fill="#efe3d3" stroke="#a8805a" strokeWidth="2" /><path d="m56 29 24 32m13-32v32m26-32-16 32" stroke="#d3b99b" /><path d="M88 70v10" stroke="#985c2b" strokeWidth="3" strokeLinecap="round" /><path d="M51 83h76v21a17 17 0 0 1-17 17H68a17 17 0 0 1-17-17Z" fill="#fff" stroke="#a8805a" strokeWidth="2" /><path d="M128 87h9a12 12 0 0 1 0 24h-12M43 125h92" stroke="#a8805a" strokeWidth="2" strokeLinecap="round" /></svg>;
}

export function ReaderApp({ state, dispatch }) {
  const page = READER_PAGES[state.page];
  const setPage = (value) => setValue(dispatch, 'reader', 'page', value);
  return <div className="app-reader">
    <aside className="app-reader-outline"><div className="app-sidebar-label">目次</div>{READER_CHAPTERS.map((chapter, index) => <div className="app-reader-chapter" key={chapter.title}><button className={page.chapter === index ? 'is-selected' : ''} onClick={() => setPage(chapter.page)}><span>{String(index + 1).padStart(2, '0')}</span>{chapter.title}</button>{page.chapter === index ? <div>{READER_PAGES.map((item, pageIndex) => item.chapter === index ? <button key={item.title} className={state.page === pageIndex ? 'is-current' : ''} onClick={() => setPage(pageIndex)}>{item.title}<small>{item.number}</small></button> : null)}</div> : null}</div>)}<span className="app-reader-chapter-hint">章の始まりは<br />強めのクリック</span></aside>
    <div className="app-reader-book"><div className="app-reader-sheet"><p className="app-book-kicker">A SMALL COFFEE GUIDE</p><span className="app-book-chapter">第 {page.chapter + 1} 章　{READER_CHAPTERS[page.chapter].title}</span><h1>{page.title}</h1>{state.page === 0 ? <CoffeeFigure /> : null}{page.paragraphs.map((text) => <p key={text}>{text}</p>)}{state.page === 0 ? <div className="app-coffee-recipe"><span>豆<strong>15 <small>g</small></strong></span><span>湯<strong>250 <small>g</small></strong></span><span>一杯分<strong>1 <small>cup</small></strong></span></div> : null}<span className="app-book-page">{page.number}</span></div><footer className="app-reader-footer"><button className="app-tool-button" aria-label="前のページ" disabled={state.page === 0} onClick={() => setPage(state.page - 1)}>←</button><span>{state.page + 1} / {READER_PAGES.length}</span><button className="app-tool-button" aria-label="次のページ" disabled={state.page === READER_PAGES.length - 1} onClick={() => setPage(state.page + 1)}>→</button></footer></div>
  </div>;
}
