import { Link } from 'react-router-dom';

export function HomePage() {
  return <>
    <section className="hero">
      <div><p className="eyebrow">每一條線索，都值得被看見</p><h1>一起，<br />找回回家的路。</h1>
        <p className="lead">牠不只是寵物，是家人。登記走失資訊，比對收容動物，讓新的線索有機會找到你。</p>
        <div className="actions"><Link className="button primary" to="/report-lost">登記走失寵物</Link><Link className="button" to="/quick-use">先快速比對</Link></div>
      </div>
      <img className="hero-image" src="/images/twobao222.jpg" alt="兩隻相伴的貓咪" />
    </section>
    <section className="section"><h2>從一筆登記，開始協尋</h2>
      <ol className="steps"><li><h3>留下辨識線索</h3><p>填寫物種、外觀與走失地點，保存你的協尋案件。</p></li><li><h3>查看可能的匹配</h3><p>比對收容資訊，查看特徵、位置及聯絡方式。</p></li><li><h3>追蹤與確認</h3><p>接收通知、聯絡收容單位，找到家人後更新案件狀態。</p></li></ol>
    </section>
    <section className="callout"><div><h2>也許，牠正在等你</h2><p>瀏覽收容動物照片，留意熟悉的身影。</p></div><Link className="button" to="/shelter-animals">查看收容動物</Link></section>
  </>;
}
