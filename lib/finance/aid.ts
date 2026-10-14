export interface AidOffer {
  grants: number;
  scholarships: number;
  federalLoans: number;
  workStudy: number;
  estimatedCostOfAttendance: number;
}

export const sampleAidOffer: AidOffer = {
  grants: 4000,
  scholarships: 2500,
  federalLoans: 5500,
  workStudy: 2000,
  estimatedCostOfAttendance: 28000
};

export function parseSampleAidOffer(offer = sampleAidOffer) {
  const freeAid = offer.grants + offer.scholarships;
  const potentialAid = freeAid + offer.federalLoans + offer.workStudy;
  const estimatedRemainingCost = offer.estimatedCostOfAttendance - potentialAid;

  return {
    ...offer,
    freeAid,
    borrowedAid: offer.federalLoans,
    earnableAid: offer.workStudy,
    estimatedRemainingCost,
    summary: `Grants and scholarships cover $${freeAid.toLocaleString()} of the estimated cost. The $${offer.federalLoans.toLocaleString()} federal loan would need to be repaid. Work-study is potential earned income, not cash already available.`
  };
}
