interface Features {
  payment: boolean
}

export default class FeatureFlags {
  static features: Features = {
    payment: false,
  };

  static setUser(userId: string) {
    if (userId === '1175524760316632413') {
      FeatureFlags.features.payment = true;
    }
  }
}
