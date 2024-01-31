export default class Monitoring {
  sentry: any | undefined;

  mixpanel: any | undefined;

  static instance: Monitoring | undefined;

  constructor(sentry?: any, mixpanel?: any) {
    Monitoring.instance = this;

    if (!sentry && !mixpanel) {
      this.sentry = undefined;
      this.mixpanel = undefined;
      // proxy!
      return;
    }

    this.sentry = sentry;
    this.mixpanel = mixpanel;
  }

  async mixedPanelPeopleIncrement(property: string, value: number) {
    this.mixpanel?.people?.increment?.(property, value);
  }

  async sentryCaptureMesage(message: string) {
    this.sentry?.captureMessage(message);
  }

  async sentryCaptureException(error: Error, extra: any) {
    this.sentry?.captureException(error, extra);
  }
}
