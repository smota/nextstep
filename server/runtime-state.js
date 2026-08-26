import path from 'node:path'
import { PATHS } from './config/paths.js'
import { ActionRunner } from './actions/runner.js'
import { HarnessRuntime, RuntimeSettings, probeHarnesses } from './actions/runtime.js'
import { invalidateVaultCache } from './vault/index.js'
import { IntakeStore } from './intakes.js'

let state
export async function initializeRuntime(options={}){
  const settings=options.settings||new RuntimeSettings({filePath:process.env.RUNTIME_SETTINGS_PATH||PATHS.runtimeSettingsPath})
  await settings.load()
  const harnesses=await probeHarnesses(options.probeOptions||{})
  const runtime=new HarnessRuntime({harnesses,settings})
  const intakeStore=options.intakeStore||new IntakeStore(PATHS.intakesDir)
  state={settings,runtime,runner:new ActionRunner({vaultRoot:PATHS.vaultRoot,runtime,paths:PATHS,invalidate:invalidateVaultCache,intakeResolver:id=>intakeStore.get(id)})}
  return state
}
export function getRuntimeState(){if(!state)throw new Error('Runtime has not been initialized');return state}
export function setRuntimeState(value){state=value}
