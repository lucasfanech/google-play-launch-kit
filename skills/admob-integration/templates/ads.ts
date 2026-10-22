// AdMob: rewarded videos for free chests and a capped interstitial video after chest openings.
// Policy notes (AdMob + Google Play):
// - consent (UMP / GDPR) is gathered before the SDK is initialised or any ad is requested;
// - rewarded ads are always opt-in, labelled as ads, and the reward is granted only on EARNED_REWARD;
// - interstitials only appear at a natural pause (after a chest reward is dismissed), never at launch,
//   never right after another ad, and are frequency-capped below;
// - audience is 13+ (not child-directed), with ad content capped at rating T.
import mobileAds, {
  AdEventType, AdsConsent, AdsConsentPrivacyOptionsRequirementStatus, InterstitialAd, MaxAdContentRating,
  RewardedAd, RewardedAdEventType, TestIds,
} from 'react-native-google-mobile-ads';
import { create } from 'zustand';
// Project hooks - wire these to your app (or replace with no-ops):
//  - setFullscreenAdActive(true/false): pause idle/offline-earnings timers while a full-screen ad covers the app
//  - pauseMusic / resumeMusic: silence background music during ads
import { setFullscreenAdActive } from '@/game/store';
import { pauseMusic, resumeMusic } from '@/ui/feedback';

// production units from the AdMob console; test units in development so we never click our own ads
const UNITS = {
  rewarded: __DEV__ ? TestIds.REWARDED : 'ca-app-pub-XXXXXXXXXXXXXXXX/REWARDED_UNIT',
  interstitial: __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-XXXXXXXXXXXXXXXX/INTERSTITIAL_UNIT',
};

/** interstitial pacing, agree the pacing with the app owner; these are the "moderate" defaults */
export const INTERSTITIAL = {
  everyChestOpens: 4,       // at most one interstitial per 4 chest openings
  minGapMs: 3 * 60_000,     // at least 3 minutes between two interstitials (or after a rewarded video)
  graceMs: 2 * 60_000,      // nothing during the first 2 minutes of a session
};

type AdsState = { ready: boolean; rewardedLoaded: boolean; showing: boolean; privacyRequired: boolean };
export const useAds = create<AdsState>(() => ({ ready: false, rewardedLoaded: false, showing: false, privacyRequired: false }));

const sessionStart = Date.now();
let lastFullscreenAt = 0;
let opensSinceInterstitial = 0;
let rewarded: RewardedAd | null = null;
let interstitial: InterstitialAd | null = null;
let interstitialLoaded = false;
let started = false;

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** consent first, then SDK init and preloading; safe to call more than once */
export async function initAds() {
  if (started) return;
  started = true;
  try {
    await AdsConsent.gatherConsent();
  } catch { /* consent form unavailable: fall through, canRequestAds decides */ }
  let canRequest = false;
  try {
    const info = await AdsConsent.getConsentInfo();
    canRequest = info.canRequestAds;
    useAds.setState({ privacyRequired: info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED });
  } catch { /* no consent info */ }
  if (!canRequest) return;
  await mobileAds().setRequestConfiguration({
    maxAdContentRating: MaxAdContentRating.T,
    tagForChildDirectedTreatment: false,
    tagForUnderAgeOfConsent: false,
  });
  await mobileAds().initialize();
  useAds.setState({ ready: true });
  loadRewarded();
  loadInterstitial();
}

/** lets the player review or withdraw consent, required when the UMP form says so */
export async function showPrivacyOptions() {
  try { await AdsConsent.showPrivacyOptionsForm(); } catch { /* not available */ }
}

/* ---------- rewarded ---------- */
let rewardResolve: ((earned: boolean) => void) | null = null;
let earned = false;

function loadRewarded() {
  rewarded = RewardedAd.createForAdRequest(UNITS.rewarded);
  rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => useAds.setState({ rewardedLoaded: true }));
  rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; });
  rewarded.addAdEventListener(AdEventType.CLOSED, () => finishRewarded());
  rewarded.addAdEventListener(AdEventType.ERROR, () => {
    useAds.setState({ rewardedLoaded: false });
    if (rewardResolve) finishRewarded();
    else setTimeout(loadRewarded, 30_000); // retry later on load failure
  });
  rewarded.load();
}

function finishRewarded() {
  lastFullscreenAt = Date.now();
  useAds.setState({ showing: false, rewardedLoaded: false });
  setFullscreenAdActive(false);
  resumeMusic();
  const resolve = rewardResolve;
  rewardResolve = null;
  resolve?.(earned);
  loadRewarded();
}

/** plays a rewarded video; resolves true only if the reward was earned */
export function showRewarded(): Promise<boolean> {
  if (!rewarded || !useAds.getState().rewardedLoaded || useAds.getState().showing) return Promise.resolve(false);
  earned = false;
  useAds.setState({ showing: true });
  setFullscreenAdActive(true);
  pauseMusic();
  return new Promise(resolve => {
    rewardResolve = resolve;
    rewarded!.show().catch(() => finishRewarded());
  });
}

/* ---------- interstitial ---------- */
function loadInterstitial() {
  interstitialLoaded = false;
  interstitial = InterstitialAd.createForAdRequest(UNITS.interstitial);
  interstitial.addAdEventListener(AdEventType.LOADED, () => { interstitialLoaded = true; });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    lastFullscreenAt = Date.now();
    useAds.setState({ showing: false });
    setFullscreenAdActive(false);
    resumeMusic();
    loadInterstitial();
  });
  interstitial.addAdEventListener(AdEventType.ERROR, () => {
    useAds.setState({ showing: false });
    setTimeout(loadInterstitial, 60_000);
  });
  interstitial.load();
}

/** pure pacing rule, exported for tests */
export function interstitialAllowed(now: number, opens: number, lastAt: number, startedAt: number) {
  return opens >= INTERSTITIAL.everyChestOpens && now - lastAt >= INTERSTITIAL.minGapMs && now - startedAt >= INTERSTITIAL.graceMs;
}

/** call after the player dismisses a chest reward (a natural pause in the game) */
export function onChestRewardClosed() {
  opensSinceInterstitial++;
  const now = Date.now();
  if (!interstitial || !interstitialLoaded || useAds.getState().showing) return;
  if (!interstitialAllowed(now, opensSinceInterstitial, lastFullscreenAt, sessionStart)) return;
  opensSinceInterstitial = 0;
  useAds.setState({ showing: true });
  setFullscreenAdActive(true);
  pauseMusic();
  interstitial.show().catch(() => { useAds.setState({ showing: false }); setFullscreenAdActive(false); resumeMusic(); });
}

/** an occasional, opt-in offer of an extra chest after opening one */
export function shouldOfferBonusChest(chestsLeftToday: number) {
  return useAds.getState().rewardedLoaded && chestsLeftToday > 0 && Math.random() < 0.35;
}
