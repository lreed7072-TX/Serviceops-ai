"use client";

import { ReactNode, useState } from "react";
import { CheckInProvider } from "@/contexts/CheckInContext";
import { CheckInBanner } from "@/components/CheckInBanner";
import { FreeCameraModal } from "@/components/FreeCameraModal";

export function TechLayoutClient({ children }: { children: ReactNode }) {
  const [showCamera, setShowCamera] = useState(false);

  return (
    <CheckInProvider>
      <CheckInBanner />
      {children}
      
      {/* Floating Camera Button */}
      <button
        onClick={() => setShowCamera(true)}
        className="floating-camera-btn"
        title="Free Camera - Take photos anytime"
      >
        📷
      </button>

      <FreeCameraModal 
        isOpen={showCamera} 
        onClose={() => setShowCamera(false)} 
      />

      <style jsx>{`
        .floating-camera-btn {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          width: 4rem;
          height: 4rem;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
          font-size: 2rem;
          cursor: pointer;
          z-index: 40;
          transition: all 0.2s ease;
        }
        
        .floating-camera-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 12px 20px rgba(0, 0, 0, 0.4);
        }
        
        .floating-camera-btn:active {
          transform: scale(0.95);
        }
      `}</style>
    </CheckInProvider>
  );
}
