export type ControllerSlot = {
  slot: number;
  connected: boolean;
  down: string[];
  areaId: string | null;
  seat: number | null;
  suspect: boolean;
};

export type ControllerState = {
  slots: ControllerSlot[];
  mapping: Record<string, string>;
  buttons: { id: string; label: string }[];
  capture: { type: "assign" | "button"; areaId?: string; seat?: number } | null;
};

export type BackupStatus = {
  dir: string;
  isDefault: boolean;
  lastAt: number | null;
  lastFile: string | null;
  error: string | null;
  busy: boolean;
};

export type DesktopBridge = {
  backup: {
    status: () => Promise<BackupStatus>;
    now: () => Promise<BackupStatus>;
    chooseFolder: () => Promise<BackupStatus>;
    defaultFolder: () => Promise<BackupStatus>;
    openFolder: () => Promise<void>;
    restore: () => Promise<{ ok: boolean; error?: string }>;
  };
  controllers: {
    get: () => Promise<ControllerState>;
    subscribe: (listener: (state: ControllerState) => void) => () => void;
    assign: (areaId: string, seat: number, exclude?: number[]) => Promise<{ ok: boolean; slot?: number }>;
    captureButton: () => Promise<{ ok: boolean; slot?: number; button?: string }>;
    cancel: () => Promise<void>;
    unassign: (slot: number) => Promise<void>;
    setMapping: (mapping: Record<string, string>) => Promise<{ ok: boolean; error?: string }>;
    identify: (slot: number) => Promise<void>;
  };
};

declare global {
  interface Window {
    compcounterDesktop?: DesktopBridge;
  }
}
