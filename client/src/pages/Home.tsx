/**
 * Home.tsx — RECORE 棚卸しスキャナー
 * Design: Industrial Utility / Warehouse Aesthetic
 * Theme: Dark Navy (#0F172A) + Amber accent
 *
 * 機能:
 * - カメラスキャンモード（iPhone Safari HTTPS対応）
 * - 手動入力モード（カメラ不可時・バーコードリーダー接続時）
 * - 読み取り結果を縦リスト表示
 * - 数量編集
 * - 一括コピー（改行区切り）
 * - Excelダウンロード（xlsx）
 * - ログイン不要・URLアクセスのみで使用可能
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// ── 型定義 ──────────────────────────────────────────────
interface ScannedItem {
  id: string;
  code: string;
  qty: number;
  scannedAt: Date;
}

type TabMode = "camera" | "manual";

// ── ユーティリティ ──────────────────────────────────────
function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── メインコンポーネント ────────────────────────────────
export default function Home() {
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [tab, setTab] = useState<TabMode>("camera");
  const [manualInput, setManualInput] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [sessionName, setSessionName] = useState(() => {
    const now = new Date();
    return `棚卸し_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  });
  const [editingSessionName, setEditingSessionName] = useState(false);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  // カメラタブに切り替えたら自動起動
  useEffect(() => {
    if (tab === "camera") {
      setIsCameraActive(true);
    } else {
      setIsCameraActive(false);
      // 手動入力タブに切り替えたらフォーカス
      setTimeout(() => manualInputRef.current?.focus(), 100);
    }
  }, [tab]);

  // アイテム追加後に末尾へスクロール
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length]);

  // ── スキャン処理 ──────────────────────────────────────
  const handleScan = useCallback((code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    setItems((prev) => {
      // 同じコードが既にあれば数量+1
      const existing = prev.find((i) => i.code === trimmed);
      if (existing) {
        toast.success(`+1: ${trimmed}`, { duration: 1200 });
        return prev.map((i) =>
          i.code === trimmed ? { ...i, qty: i.qty + 1 } : i
        );
      }
      toast.success(`追加: ${trimmed}`, { duration: 1200 });
      return [
        ...prev,
        { id: generateId(), code: trimmed, qty: 1, scannedAt: new Date() },
      ];
    });
  }, []);

  // ── 手動入力 ──────────────────────────────────────────
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualInput.trim();
    if (!trimmed) return;
    handleScan(trimmed);
    setManualInput("");
    manualInputRef.current?.focus();
  };

  // ── 数量変更 ──────────────────────────────────────────
  const handleQtyChange = (id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const handleQtyInput = (id: string, val: string) => {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) return;
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: n } : i))
        .filter((i) => i.qty > 0)
    );
  };

  // ── 削除 ──────────────────────────────────────────────
  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // ── 全クリア ──────────────────────────────────────────
  const handleClear = () => {
    if (items.length === 0) return;
    if (!confirm(`${items.length}件のデータをすべて削除しますか？`)) return;
    setItems([]);
    toast.info("リストをクリアしました");
  };

  // ── コピー（コードのみ・改行区切り） ──────────────────
  const handleCopyCodes = async () => {
    if (items.length === 0) {
      toast.error("コピーするデータがありません");
      return;
    }
    // 数量分だけコードを繰り返す（qty=3なら3行）
    const lines = items.flatMap((i) => Array(i.qty).fill(i.code));
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${lines.length}件のコードをコピーしました`);
    } catch {
      // フォールバック
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success(`${lines.length}件のコードをコピーしました`);
    }
  };

  // ── コピー（コード＋数量・タブ区切り） ──────────────
  const handleCopyWithQty = async () => {
    if (items.length === 0) {
      toast.error("コピーするデータがありません");
      return;
    }
    const header = "バーコード\t数量\t読取時刻";
    const lines = items.map(
      (i) => `${i.code}\t${i.qty}\t${formatTime(i.scannedAt)}`
    );
    const text = [header, ...lines].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${items.length}件（コード＋数量）をコピーしました`);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success(`${items.length}件（コード＋数量）をコピーしました`);
    }
  };

  // ── Excelダウンロード ─────────────────────────────────
  const handleDownloadExcel = () => {
    if (items.length === 0) {
      toast.error("ダウンロードするデータがありません");
      return;
    }
    const rows = items.map((i) => ({
      バーコード: i.code,
      数量: i.qty,
      読取時刻: formatTime(i.scannedAt),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    // 列幅調整
    ws["!cols"] = [{ wch: 30 }, { wch: 8 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "棚卸し");
    XLSX.writeFile(wb, `${sessionName}.xlsx`);
    toast.success("Excelファイルをダウンロードしました");
  };

  // ── 集計 ──────────────────────────────────────────────
  const totalItems = items.length;
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  // ── レンダリング ──────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "oklch(0.13 0.025 255)", maxWidth: 600, margin: "0 auto" }}
    >
      {/* ヘッダー */}
      <header
        className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
        style={{
          background: "oklch(0.13 0.025 255)",
          borderBottom: "1px solid oklch(0.28 0.025 255)",
        }}
      >
        <div className="flex items-center gap-2">
          {/* ロゴ */}
          <div
            className="w-8 h-8 rounded flex items-center justify-center font-bold text-xs"
            style={{ background: "oklch(0.76 0.17 75)", color: "oklch(0.13 0.025 255)" }}
          >
            RC
          </div>
          <div>
            <p className="text-xs" style={{ color: "oklch(0.60 0.015 255)" }}>
              RECORE
            </p>
            <p className="text-sm font-semibold leading-tight" style={{ color: "oklch(0.94 0.01 255)" }}>
              棚卸しスキャナー
            </p>
          </div>
        </div>

        {/* セッション名 */}
        <div className="flex items-center gap-1">
          {editingSessionName ? (
            <input
              autoFocus
              className="text-xs px-2 py-1 rounded border font-mono"
              style={{
                background: "oklch(0.22 0.025 255)",
                border: "1px solid oklch(0.76 0.17 75)",
                color: "oklch(0.94 0.01 255)",
                width: 160,
              }}
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              onBlur={() => setEditingSessionName(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingSessionName(false)}
            />
          ) : (
            <button
              onClick={() => setEditingSessionName(true)}
              className="text-xs px-2 py-1 rounded font-mono"
              style={{
                background: "oklch(0.20 0.020 255)",
                color: "oklch(0.76 0.17 75)",
                border: "1px solid oklch(0.28 0.025 255)",
              }}
              title="タップしてセッション名を編集"
            >
              ✏ {sessionName}
            </button>
          )}
        </div>
      </header>

      {/* タブ切り替え */}
      <div
        className="flex px-4 pt-3 pb-0 gap-2"
        style={{ borderBottom: "1px solid oklch(0.28 0.025 255)" }}
      >
        {(["camera", "manual"] as TabMode[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors"
            style={{
              background:
                tab === t ? "oklch(0.17 0.025 255)" : "transparent",
              color:
                tab === t
                  ? "oklch(0.76 0.17 75)"
                  : "oklch(0.60 0.015 255)",
              borderBottom:
                tab === t
                  ? "2px solid oklch(0.76 0.17 75)"
                  : "2px solid transparent",
            }}
          >
            {t === "camera" ? "📷 カメラスキャン" : "⌨️ 手動入力"}
          </button>
        ))}
      </div>

      {/* スキャン / 手動入力エリア */}
      <div className="px-4 pt-4 pb-2">
        {tab === "camera" ? (
          <div>
            <BarcodeScanner onScan={handleScan} isActive={isCameraActive} />
            <p
              className="text-xs text-center mt-2"
              style={{ color: "oklch(0.60 0.015 255)" }}
            >
              バーコードをカメラに向けてください
            </p>
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              ref={manualInputRef}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="バーコード番号を入力 または スキャナーで読み取り"
              className="font-mono text-sm flex-1"
              style={{
                background: "oklch(0.22 0.025 255)",
                border: "1px solid oklch(0.28 0.025 255)",
                color: "oklch(0.94 0.01 255)",
              }}
              autoComplete="off"
              inputMode="text"
            />
            <Button
              type="submit"
              style={{
                background: "oklch(0.76 0.17 75)",
                color: "oklch(0.13 0.025 255)",
                fontWeight: 600,
              }}
            >
              追加
            </Button>
          </form>
        )}
      </div>

      {/* 集計バー */}
      <div
        className="mx-4 mb-3 px-4 py-2 rounded-lg flex items-center justify-between"
        style={{ background: "oklch(0.17 0.025 255)", border: "1px solid oklch(0.28 0.025 255)" }}
      >
        <div className="flex gap-4">
          <div>
            <p className="text-xs" style={{ color: "oklch(0.60 0.015 255)" }}>種類数</p>
            <p className="text-xl font-bold font-mono" style={{ color: "oklch(0.76 0.17 75)" }}>
              {totalItems}
            </p>
          </div>
          <div
            style={{ width: 1, background: "oklch(0.28 0.025 255)" }}
          />
          <div>
            <p className="text-xs" style={{ color: "oklch(0.60 0.015 255)" }}>合計数量</p>
            <p className="text-xl font-bold font-mono" style={{ color: "oklch(0.94 0.01 255)" }}>
              {totalQty}
            </p>
          </div>
        </div>
        <button
          onClick={handleClear}
          className="text-xs px-3 py-1 rounded"
          style={{
            background: "oklch(0.22 0.025 255)",
            color: "oklch(0.60 0.015 255)",
            border: "1px solid oklch(0.28 0.025 255)",
          }}
        >
          クリア
        </button>
      </div>

      {/* アクションボタン群 */}
      <div className="px-4 mb-3 grid grid-cols-3 gap-2">
        <button
          onClick={handleCopyCodes}
          disabled={items.length === 0}
          className="flex flex-col items-center gap-1 py-3 rounded-lg text-xs font-medium transition-opacity disabled:opacity-40"
          style={{
            background: "oklch(0.17 0.025 255)",
            border: "1px solid oklch(0.28 0.025 255)",
            color: "oklch(0.94 0.01 255)",
          }}
        >
          <span className="text-lg">📋</span>
          コードのみ
          <span style={{ color: "oklch(0.60 0.015 255)", fontSize: "0.65rem" }}>改行区切り</span>
        </button>
        <button
          onClick={handleCopyWithQty}
          disabled={items.length === 0}
          className="flex flex-col items-center gap-1 py-3 rounded-lg text-xs font-medium transition-opacity disabled:opacity-40"
          style={{
            background: "oklch(0.17 0.025 255)",
            border: "1px solid oklch(0.28 0.025 255)",
            color: "oklch(0.94 0.01 255)",
          }}
        >
          <span className="text-lg">📊</span>
          コード＋数量
          <span style={{ color: "oklch(0.60 0.015 255)", fontSize: "0.65rem" }}>タブ区切り</span>
        </button>
        <button
          onClick={handleDownloadExcel}
          disabled={items.length === 0}
          className="flex flex-col items-center gap-1 py-3 rounded-lg text-xs font-medium transition-opacity disabled:opacity-40"
          style={{
            background: "oklch(0.76 0.17 75 / 0.15)",
            border: "1px solid oklch(0.76 0.17 75 / 0.4)",
            color: "oklch(0.76 0.17 75)",
          }}
        >
          <span className="text-lg">⬇️</span>
          Excel
          <span style={{ color: "oklch(0.76 0.17 75 / 0.7)", fontSize: "0.65rem" }}>.xlsx</span>
        </button>
      </div>

      {/* スキャンリスト */}
      <div className="px-4 pb-8 flex-1">
        {items.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-xl"
            style={{
              border: "1px dashed oklch(0.28 0.025 255)",
              color: "oklch(0.50 0.015 255)",
            }}
          >
            <svg
              className="w-12 h-12 mb-3 opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
            <p className="text-sm">バーコードをスキャンしてください</p>
            <p className="text-xs mt-1 opacity-60">読み取ったコードがここに表示されます</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* ヘッダー行 */}
            <div
              className="grid text-xs px-3 py-1"
              style={{
                gridTemplateColumns: "1fr auto auto",
                color: "oklch(0.50 0.015 255)",
              }}
            >
              <span>バーコード</span>
              <span className="text-center w-20">数量</span>
              <span className="w-8" />
            </div>

            {items.map((item, idx) => (
              <div
                key={item.id}
                className="item-enter grid items-center px-3 py-3 rounded-lg"
                style={{
                  gridTemplateColumns: "1fr auto auto",
                  background: "oklch(0.17 0.025 255)",
                  border: "1px solid oklch(0.28 0.025 255)",
                  animationDelay: `${Math.min(idx * 0.03, 0.3)}s`,
                  animationFillMode: "both",
                }}
              >
                {/* コード */}
                <div className="min-w-0">
                  <p
                    className="font-mono text-sm font-medium truncate"
                    style={{ color: "oklch(0.94 0.01 255)" }}
                  >
                    {item.code}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "oklch(0.50 0.015 255)" }}
                  >
                    {formatTime(item.scannedAt)}
                  </p>
                </div>

                {/* 数量コントロール */}
                <div className="flex items-center gap-1 mx-2">
                  <button
                    onClick={() => handleQtyChange(item.id, -1)}
                    className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold"
                    style={{
                      background: "oklch(0.22 0.025 255)",
                      color: "oklch(0.76 0.17 75)",
                      border: "1px solid oklch(0.28 0.025 255)",
                    }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) => handleQtyInput(item.id, e.target.value)}
                    className="font-mono font-bold text-center text-sm"
                    style={{
                      width: 40,
                      background: "oklch(0.22 0.025 255)",
                      border: "1px solid oklch(0.28 0.025 255)",
                      color: "oklch(0.76 0.17 75)",
                      borderRadius: 6,
                      padding: "2px 4px",
                    }}
                  />
                  <button
                    onClick={() => handleQtyChange(item.id, 1)}
                    className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold"
                    style={{
                      background: "oklch(0.22 0.025 255)",
                      color: "oklch(0.76 0.17 75)",
                      border: "1px solid oklch(0.28 0.025 255)",
                    }}
                  >
                    ＋
                  </button>
                </div>

                {/* 削除ボタン */}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="w-7 h-7 rounded flex items-center justify-center"
                  style={{
                    background: "transparent",
                    color: "oklch(0.50 0.015 255)",
                  }}
                  title="削除"
                >
                  ✕
                </button>
              </div>
            ))}
            <div ref={listEndRef} />
          </div>
        )}
      </div>

      {/* フッター */}
      <div
        className="text-center py-3 text-xs"
        style={{
          color: "oklch(0.40 0.015 255)",
          borderTop: "1px solid oklch(0.20 0.020 255)",
        }}
      >
        RECORE 棚卸しスキャナー — ログイン不要・どの端末でも使用可能
      </div>
    </div>
  );
}
