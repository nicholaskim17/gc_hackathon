import { test, expect, type Page } from '@playwright/test';

const SERVER='http://127.0.0.1:3101';

/** Title -> connect screen -> create a room, which is the only route that starts the camera. */
async function createRoom(page:Page){
  await page.getByRole('button',{name:'Play together'}).click();
  await page.locator('#server-address').fill(SERVER);
  await page.getByRole('button',{name:'Create a room'}).click();
  await expect(page.locator('#camera-status')).toBeVisible();
}

test('keyboard practice runs a round, pauses, finishes and replays',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?debug=1');
  await expect(page.getByRole('heading',{name:/Ready\. Set\./})).toBeVisible();
  await page.keyboard.press('KeyD'); // The simulator panel is fixed bottom-left; keep it off the buttons.
  await page.getByRole('button',{name:'Try without camera'}).click();
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#points-a')).toHaveText('0');

  // The racket answers the keyboard.
  await page.keyboard.down('KeyD');await page.waitForTimeout(220);await page.keyboard.up('KeyD');
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(220);await page.keyboard.up('ArrowUp');

  // Pause freezes the rally until it is resumed.
  await page.getByRole('button',{name:'Pause game'}).click();
  await expect(page.getByRole('button',{name:'Resume'})).toBeVisible();
  const frozen=await page.locator('#rally').textContent();
  await page.waitForTimeout(700);
  await expect(page.locator('#rally')).toHaveText(frozen!);
  await page.getByRole('button',{name:'Resume'}).click();
  await expect(page.getByRole('button',{name:'Resume'})).toHaveCount(0);

  // Debug scoring drives the match to its first-to-seven finish deterministically.
  for(let i=0;i<7;i++){await page.keyboard.press('Digit7');await page.waitForTimeout(60);}
  await expect(page.getByRole('button',{name:'Play again'})).toBeVisible();
  await expect(page.locator('#final-score')).toBeVisible();

  await page.getByRole('button',{name:'Play again'}).click();
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#points-a')).toHaveText('0');
  expect(errors).toEqual([]);
});

test('camera denial gives a clear keyboard exit',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>Promise.reject(new DOMException('Denied','NotAllowedError'))});});
  await page.goto('/');
  await createRoom(page);
  await expect(page.locator('#camera-status')).toHaveText('Camera access wasn’t allowed. Enable it in your browser or play with the keyboard.');
  await expect(page.locator('#camera-status')).toHaveClass(/error/);
  await page.getByRole('button',{name:'Use keyboard instead'}).click();
  await expect(page.locator('#camera-status')).toHaveText('Keyboard selected. WASD or arrow keys move your racket. Space adds a swing.');
  await expect(page.locator('#ready-button')).toBeEnabled();
  await page.getByRole('button',{name:'Leave room'}).click();
  await expect(page.getByRole('heading',{name:/Ready\. Set\./})).toBeVisible();
});

test('layout fits desktop and smaller screens',async({page})=>{
  for(const size of [{width:1440,height:1000},{width:1024,height:768},{width:390,height:844}]){
    await page.setViewportSize(size);await page.goto('/');await expect(page.locator('#arena')).toBeVisible();await page.waitForTimeout(120);
    await page.screenshot({path:`/tmp/rally-render-${size.width}.png`});
    const pixelData=await page.locator('#arena').evaluate(canvas=>{const element=canvas as HTMLCanvasElement;return element.toDataURL('image/png');});
    expect(pixelData.startsWith('data:image/png;base64,')).toBeTruthy();expect(pixelData.length).toBeGreaterThan(1000);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  }
});

test('paddle and table audio samples are served locally',async({request})=>{
  for(const path of ['/audio/paddle-hit.mp3','/audio/table-bounce.mp3']){
    const response=await request.get(path);expect(response.ok()).toBeTruthy();expect(response.headers()['content-type']).toContain('audio/mpeg');expect((await response.body()).length).toBeGreaterThan(5000);
  }
});

test('the local pose model loads in the worker and the camera is released on exit',async({playwright})=>{
  const browser=await playwright.chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  const context=await browser.newContext({permissions:['camera']});const page=await context.newPage();
  // Count real track releases so "stopped the camera" is asserted, not assumed.
  await page.addInitScript(()=>{(window as any).__stopped=0;const stop=MediaStreamTrack.prototype.stop;MediaStreamTrack.prototype.stop=function(this:MediaStreamTrack){(window as any).__stopped++;return stop.apply(this);};});
  await page.goto('http://127.0.0.1:5174/');
  await createRoom(page);
  // Reaching the calibration prompt means the MediaPipe wasm runtime and .task model
  // both loaded inside the worker; a loader failure would show the tracking error here.
  await expect(page.locator('#camera-status')).toHaveText('Step into view. Keep your head, shoulders and arms visible.',{timeout:60000});
  await expect(page.locator('#camera-ready')).toHaveClass(/ready/);
  await page.getByRole('button',{name:'Leave room'}).click();
  await expect(page.getByRole('heading',{name:/Ready\. Set\./})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__stopped)).toBeGreaterThan(0);
  await browser.close();
});

test('two independent browsers pair and enter the same network match',async({browser})=>{
  const hostContext=await browser.newContext(),guestContext=await browser.newContext();
  const host=await hostContext.newPage(),guest=await guestContext.newPage();
  try{
    await Promise.all([host.goto('/'),guest.goto('/')]);
    await createRoom(host);
    const code=(await host.locator('.room-banner b').textContent())!.trim();

    await guest.getByRole('button',{name:'Play together'}).click();
    await guest.locator('#server-address').fill(SERVER);
    await guest.locator('#room-code').fill(code);
    await guest.getByRole('button',{name:'Join room'}).click();
    await expect(guest.locator('.room-banner b')).toHaveText(code);

    for(const page of [host,guest]){
      await page.getByRole('button',{name:'Use keyboard instead'}).click();
      await expect(page.locator('#ready-button')).toBeEnabled();
      await page.locator('#ready-button').click();
    }

    await Promise.all([expect(host.locator('#score')).toBeVisible(),expect(guest.locator('#score')).toBeVisible()]);
    await expect(host.locator('#view-toggle')).toContainText('Player 1');
    await expect(guest.locator('#view-toggle')).toContainText('Player 2');
    await expect(host.locator('#points-a')).toHaveText('0');
    await expect(guest.locator('#points-a')).toHaveText('0');

    // Closing one peer exercises the server's real disconnect pause path without
    // depending on a moving game overlay or a timing-sensitive button click.
    await guestContext.close();
    await expect(host.getByRole('button',{name:'Back to menu'})).toBeVisible({timeout:5000});
    await host.getByRole('button',{name:'Back to menu'}).click();
  }finally{
    await hostContext.close();await guestContext.close();
  }
});
