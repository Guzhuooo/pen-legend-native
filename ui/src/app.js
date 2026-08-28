import { BasePage } from './base-page.js';
import { DESIGN_WIDTH } from './screen-profile.js';

class App extends $falcon.App {
  onLaunch(options) {
    super.onLaunch(options);
    // 设备 profile：物理 254x800，direction=270，逻辑画布 800x254（已真机验证）
    this.setViewPort(DESIGN_WIDTH);
    this.screenInfo = {
      designWidth: DESIGN_WIDTH,
      logicalHeight: 254,
      layout: 'width-normalized-flex-height'
    };
    $falcon.useDefaultBasePageClass(BasePage);
    console.log('[pen-legend] launch, designWidth=' + DESIGN_WIDTH);
  }

  onShow() { super.onShow(); }
  onHide() { super.onHide(); }
  onDestroy() { super.onDestroy(); }
}

try {
  globalThis['window'] = { requestAnimationFrame, cancelAnimationFrame };
} catch (err) { console.log(err); }
try {
  globalThis['process'] = { env: { NODE_ENV: 'production' } };
} catch (err) { console.log(err); }

export default App;
