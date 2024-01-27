export type TranslationCreditUsage = {
  ownerId: string,
  time: number,
  messages: number,
  characters: number,
  send: boolean,
  acknowledged: boolean,
};

export type TranslationCredit = {
  iat?: number, // the time the credit was created
  // credit id - unique when combined with the credit owner
  cid: string,
  // credit owner - if the jwt doesn't contain this property - it gets set to the current user
  co?: string
  // not before (nbf) and expiration time (exp) allows to bind tokens to a time window
  nbf?: number,
  exp?: number,
  // total message count of this credit
  msgc: number,
  // number of message credits used: msgc-msgu represent the available messages
  msgu: number,
  // the signed jwt representing this token - used to send back
  jwt: string,
};

const baseUrl = 'https://api.parrot.global/';

export default class ParrotApi {
  baseHeaders: any;

  constructor(apiKey: string) {
    this.baseHeaders = {
      'x-parrot-api-key': apiKey,
      'Content-Type': 'application/json',
      "Cache-Control": "no-cache",
    };
  }

  async synchronizeCredits(userId: string, ownerId: string, translationCreditJwts: string[], translationsCreditUsage: TranslationCreditUsage[]) {
    const url = `${baseUrl}v1/user/${userId}/credit/${ownerId}`;

    const rawBody = JSON.stringify({
      translationCreditJwts,
      translationsCreditUsage,
    });

    const result = await fetch(url, { method: 'POST', headers: this.baseHeaders, body: rawBody });

    if (!result.ok) {
      return null; // TODO #29 check error handling
    }

    return result.json();
  }
}
