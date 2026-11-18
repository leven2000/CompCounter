import koffi from 'koffi'

export function createXInput() {
  let lib
  try {
    lib = koffi.load('xinput1_4.dll')
  } catch {
    lib = koffi.load('xinput9_1_0.dll')
  }
  koffi.struct('XINPUT_GAMEPAD', {
    wButtons: 'uint16',
    bLeftTrigger: 'uint8',
    bRightTrigger: 'uint8',
    sThumbLX: 'int16',
    sThumbLY: 'int16',
    sThumbRX: 'int16',
    sThumbRY: 'int16',
  })
  koffi.struct('XINPUT_STATE', { dwPacketNumber: 'uint32', Gamepad: 'XINPUT_GAMEPAD' })
  koffi.struct('XINPUT_VIBRATION', { wLeftMotorSpeed: 'uint16', wRightMotorSpeed: 'uint16' })
  const getState = lib.func('uint32 __stdcall XInputGetState(uint32 index, _Out_ XINPUT_STATE *state)')
  const setState = lib.func('uint32 __stdcall XInputSetState(uint32 index, XINPUT_VIBRATION *vibration)')

  return {
    read(slot) {
      const state = {}
      if (getState(slot, state) !== 0) return null
      return {
        buttons: state.Gamepad.wButtons,
        lt: state.Gamepad.bLeftTrigger,
        rt: state.Gamepad.bRightTrigger,
      }
    },
    vibrate(slot, strength) {
      const speed = Math.round(Math.max(0, Math.min(1, strength)) * 65535)
      setState(slot, { wLeftMotorSpeed: speed, wRightMotorSpeed: speed })
    },
  }
}
