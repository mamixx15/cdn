/***
 *** ᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁
 *** - Dev: FongsiDev
 *** - Contact: t.me/dashmodz
 *** - Gmail: fongsiapi@gmail.com & fgsidev@neko2.net
 *** - Group: chat.whatsapp.com/Ke94ex9fNLjE2h8QzhvEiy
 *** - Telegram Group: t.me/fongsidev
 *** - Github: github.com/Fgsi-APIs/RestAPIs/issues/new
 *** - Website: fgsi.koyeb.app
 *** ᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁
 ***/

// Scraper By Fgsi

import cloudscraper from "cloudscraper";
import * as cheerio from "cheerio";

export class TutwuriBypassClient {
  constructor(apikey) {
    this.apikey = apikey;
    this.cookies = [];
    this.refererLocation = "";
  }

  async get(shortlink) {
    await this.step1_getInitialPage(shortlink);
    await this.step2_redirectWithParams();
    //await this.step3_getSession();
    await this.step4_bypassTurnstile();
    await this.step5_verify();
    //await this.step6_getSessionAgain();
    return await this.step7_go();
  }

  async step1_getInitialPage(shortlink) {
  const html = await this.client.get(shortlink);

  const $ = cheerio.load(html);
  this.rayId = $('input[name="ray_id"]').val();
  this.alias = $('input[name="alias"]').val();
}

  async step2_redirectWithParams() {
  const res = await this.client.get({
    url: "https://tutwuri.id/redirect.php",
    qs: {
      ray_id: this.rayId,
      alias: this.alias
    },
    headers: {
      ...this.defaultHeaders("tutwuri.id"),
      referer: "https://sfl.gl/"
    },
    resolveWithFullResponse: true,
    simple: false,
    followRedirect: false
  });

  this.refererLocation = res.headers.location;
}

  async step3_getSession() {
  this.session1 = await this.client.get({
    url: "https://tutwuri.id/api/v1/session",
    json: true,
    headers: {
      ...this.apiHeaders(),
      referer: `https://tutwuri.id/${this.refererLocation}`
    }
  });
}

  async step4_bypassTurnstile() {
  const res = await this.client.get({
    url: "https://fgsi.koyeb.app/api/tools/bypasscf/v5",
    qs: {
      apikey: this.apikey,
      url: "https://tutwuri.id/",
      mode: "turnstile-min",
      sitekey: "0x4AAAAAAAfjzEk6sEUVcFw1"
    },
    json: true,
    headers: {
      accept: "application/json"
    }
  });

  if (!res?.status) throw new Error(res?.message || "Bypass Turnstile gagal");

  this.bypassResult = res.data;
}

  async step5_verify() {
  this.verification = await this.client.post({
    url: "https://tutwuri.id/api/v1/verify",
    json: true,
    body: {
      _a: 0,
      "cf-turnstile-response": this.bypassResult.token
    },
    headers: {
      ...this.apiHeaders(),
      origin: "https://tutwuri.id",
      referer: `https://tutwuri.id/${this.refererLocation}`
    }
  });
}

  async step6_getSessionAgain() {
  this.session2 = await this.client.get({
    url: "https://tutwuri.id/api/v1/session",
    json: true,
    headers: {
      ...this.apiHeaders(),
      referer: `https://tutwuri.id/${this.refererLocation}`
    }
  });
}

  async step7_go() {
  const res = await this.client.post({
    url: "https://tutwuri.id/api/v1/go",
    json: true,
    body: {
      key: Math.floor(Math.random() * 1000),
      size: "2278.3408",
      _dvc: btoa(String(Math.floor(Math.random() * 1000)))
    },
    headers: {
      ...this.apiHeaders(),
      origin: "https://tutwuri.id",
      referer: `https://tutwuri.id/${this.refererLocation}`
    }
  });

  return {
    ...res,
    linkGo: this.decodeUParam(res.url)
  };
}

  defaultHeaders(host) {
    return {
      authority: host,
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "ms-MY,ms;q=0.9,en-US;q=0.8,en;q=0.7",
      "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      "user-agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36",
    };
  }

  apiHeaders() {
    return {
      authority: "tutwuri.id",
      accept: "application/json, text/plain, */*",
      "accept-language": "ms-MY,ms;q=0.9,en-US;q=0.8,en;q=0.7",
      apiHeaders() {
  return {
    authority: "tutwuri.id",
    accept: "application/json, text/plain, */*",
    "accept-language": "ms-MY,ms;q=0.9,en-US;q=0.8,en;q=0.7",
    "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent":
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36"
  };
}

  appendCookies(cookieArr) {
    if (!Array.isArray(cookieArr)) return;
    const parsed = cookieArr.map((c) => c.split(";")[0]);
    this.cookies.push(...parsed);
  }

  getCookieHeader() {
    return decodeURIComponent(this.cookies.join("; "));
  }

  decodeUParam(fullUrl) {
    if (!fullUrl) return null;
    const urlObj = new URL(fullUrl);
    const encodedU = urlObj.searchParams.get("u");
    if (!encodedU) {
      throw new Error('Parameter "u" tidak ditemukan dalam URL.');
    }
    return atob(decodeURIComponent(encodedU));
  }
}

const client = new TutwuriBypassClient("your apikey");
const result = await client.get("https://sfl.gl/41EapuZ");
console.log("Final Result:", result);