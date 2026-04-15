/**
 * BarcodeScanner.tsx
 * Design: Industrial Utility — Dark Navy + Amber
 *
 * iPhone Safari 対応ポイント:
 * - HTTPS環境でのみ getUserMedia が動作する
 * - facingMode: "environment" を明示的に指定
 * - html5-qrcode の設定を Safari 向けに最適化
 * - カメラ起動失敗時は手動入力モードにフォールバック
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  isActive: boolean;
}

export function BarcodeScanner({ onScan, isActive }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const lastScannedRef = useRef<string>("");
  const lastScannedTimeRef = useRef<number>(0);
  const mountedRef = useRef(true);

  const handleSuccess = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      if (
        decodedText === lastScannedRef.current &&
        now - lastScannedTimeRef.current < 1500
      ) {
        return;
      }
      lastScannedRef.current = decodedText;
      lastScannedTimeRef.current = now;

      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 500);

      if (navigator.vibrate) {
        navigator.vibrate(80);
      }

      onScan(decodedText);
    },
    [onScan]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const scannerId = "html5-qrcode-scanner";
    let scanner: Html5Qrcode | null = null;

    const startScanner = async () => {
      if (!mountedRef.current) return;
      setIsStarting(true);
      setError(null);

      try {
        scanner = new Html5Qrcode(scannerId, { verbose: false });
        scannerRef.current = scanner;

        // iPhone Safari では qrbox を小さめにすると安定する
        const qrboxSize = Math.min(
          Math.floor(window.innerWidth * 0.7),
          260
        );

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: qrboxSize, height: Math.floor(qrboxSize * 0.6) },
            aspectRatio: window.innerWidth < 500 ? 1.0 : 1.5,
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true,
            },
          } as Parameters<typeof scanner.start>[1],
          handleSuccess,
          () => {} // エラーは無視（スキャン中の通常エラー）
        );
      } catch (err) {
        if (!mountedRef.current) return;
        const msg = String(err);
        if (
          msg.includes("Permission") ||
          msg.includes("NotAllowed") ||
          msg.includes("denied")
        ) {
          setError("camera_permission");
        } else if (
          msg.includes("NotFound") ||
          msg.includes("Requested device not found")
        ) {
          setError("camera_not_found");
        } else {
          setError("camera_generic");
        }
      } finally {
        if (mountedRef.current) setIsStarting(false);
      }
    };

    startScanner();

    return () => {
      if (scanner) {
        scanner.isScanning &&
          scanner.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isActive, handleSuccess]);

  const errorMessages: Record<string, { title: string; detail: string }> = {
    camera_permission: {
      title: "カメラへのアクセスが拒否されました",
      detail:
        "設定 → Safari → カメラ → 許可 に変更してください（iPhone）\nまたはブラウザのアドレスバーのカメラアイコンから許可してください",
    },
    camera_not_found: {
      title: "カメラが見つかりません",
      detail: "端末にカメラが搭載されているか確認してください",
    },
    camera_generic: {
      title: "カメラを起動できませんでした",
      detail:
        "HTTPSのURLでアクセスしているか確認してください\nSafariの場合: 設定 → プライバシーとセキュリティ → カメラ",
    },
  };

  const errInfo = error ? errorMessages[error] : null;

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ minHeight: 220 }}>
      {/* カメラ映像 */}
      <div
        id="html5-qrcode-scanner"
        className="w-full"
        style={{ minHeight: 220 }}
      />

      {/* 成功フラッシュ */}
      {isFlashing && (
        <div
          className="absolute inset-0 pointer-events-none scan-success"
          style={{ zIndex: 10 }}
        />
      )}

      {/* スキャン枠 */}
      {isActive && !error && !isStarting && (
        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          style={{ zIndex: 5 }}
        >
          <div
            className="relative"
            style={{
              width: Math.min(Math.floor(window.innerWidth * 0.7), 260),
              height: Math.floor(Math.min(Math.floor(window.innerWidth * 0.7), 260) * 0.6),
            }}
          >
            <div className="absolute top-0 left-0 w-7 h-7 scan-corner-tl" />
            <div className="absolute top-0 right-0 w-7 h-7 scan-corner-tr" />
            <div className="absolute bottom-0 left-0 w-7 h-7 scan-corner-bl" />
            <div className="absolute bottom-0 right-0 w-7 h-7 scan-corner-br" />
          </div>
        </div>
      )}

      {/* 起動中 */}
      {isStarting && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-xl"
          style={{ zIndex: 20 }}
        >
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-muted-foreground">カメラを起動中...</p>
        </div>
      )}

      {/* エラー */}
      {errInfo && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 rounded-xl p-5"
          style={{ zIndex: 20 }}
        >
          <svg
            className="w-10 h-10 mb-3"
            style={{ color: "oklch(0.76 0.17 75)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
            />
          </svg>
          <p className="text-sm font-semibold text-foreground text-center mb-2">
            {errInfo.title}
          </p>
          <p className="text-xs text-muted-foreground text-center whitespace-pre-line leading-relaxed">
            {errInfo.detail}
          </p>
          <p className="text-xs text-center mt-3" style={{ color: "oklch(0.76 0.17 75)" }}>
            ↓ 下の「手動入力」タブをご利用ください
          </p>
        </div>
      )}
    </div>
  );
}
