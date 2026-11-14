import type { ProductionStore } from './store.js';
import type { CommandProcessor } from '../communication/processor.js';

/**
 * One server-side timer for the nearest FEATURED expiration.
 * The persisted absolute timestamp, not a process-relative countdown, is authoritative.
 * Re-arm on every committed UPDATE; expiry itself emits an UPDATE via the processor.
 */
export class ProductionRuntime {
  private timer:ReturnType<typeof setTimeout>|null=null;
  private unsubscribe:(()=>void)|null=null;
  private active=false;
  private readonly MAX_DELAY=2_147_483_647;

  constructor(
    private readonly store:ProductionStore,
    private readonly processor:CommandProcessor,
    private readonly clock:()=>number=Date.now,
    private readonly setTimer:(callback:()=>void,delay:number)=>ReturnType<typeof setTimeout>=setTimeout,
    private readonly clearTimer:(handle:ReturnType<typeof setTimeout>)=>void=clearTimeout,
    private readonly reportError:(error:unknown)=>void=()=>{},
  ) {}

  start():void {
    if(this.active)return;
    this.active=true;
    this.unsubscribe=this.processor.subscribe(()=>this.arm());
    this.arm();
  }

  stop():void {
    this.active=false;
    this.unsubscribe?.();
    this.unsubscribe=null;
    this.cancelTimer();
  }

  private cancelTimer():void {
    if(this.timer!==null)this.clearTimer(this.timer);
    this.timer=null;
  }

  private arm():void {
    this.cancelTimer();
    if(!this.active)return;
    const current=this.store.read();
    if(current.streamId===null)return;
    const deadline=current.state.featured.expiresAtMs;
    if(deadline===null)return;
    const delay=Math.min(this.MAX_DELAY,Math.max(0,deadline-this.clock()));
    this.timer=this.setTimer(()=>this.fire(),delay);
    this.timer.unref?.();
  }

  private fire():void {
    this.timer=null;
    if(!this.active)return;
    try {
      this.processor.reconcileRuntime();
      this.arm();
    } catch(error) {
      // Database outage must not fabricate a successful revision. Retry, bounded.
      this.reportError(error);
      if(this.active) {
        this.cancelTimer();
        this.timer=this.setTimer(()=>this.fire(),1000);
        this.timer.unref?.();
      }
    }
  }
}
