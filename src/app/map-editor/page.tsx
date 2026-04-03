"use client";
import { useAccount } from "wagmi";
import { MapPinEditor } from "@/components/MapPinEditor";

// Set NEXT_PUBLIC_MAP_EDITOR=1 in .env.local to enable, remove/unset for production
const EDITOR_ENABLED = process.env.NEXT_PUBLIC_MAP_EDITOR === "1";
const ADMIN_WALLETS = [
  "0x0780b1456d5e60cf26c8cd6541b85e805c8c05f2",
];

export default function MapEditorPage() {
  const { address } = useAccount();
  const isAdmin = ADMIN_WALLETS.includes(address?.toLowerCase() ?? "");

  if (!EDITOR_ENABLED || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0608" }}>
        <p style={{ color: "#f0d070", fontFamily: "'Cinzel', serif" }}>
          {!EDITOR_ENABLED ? "Map editor is disabled." : "Connect admin wallet to access the map editor."}
        </p>
      </div>
    );
  }

  return <MapPinEditor />;
}
