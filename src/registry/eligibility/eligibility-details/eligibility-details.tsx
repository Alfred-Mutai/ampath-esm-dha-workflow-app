import React from "react";
import { type HieClientEligibility } from "../../types";
import styles from './eligibility-details.scss';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from "@carbon/react";
import { getTagType } from "../../../shared/utils/get-tag-type";

interface EligibilityDetailsProps{
   hieClientEligibility: HieClientEligibility
}

const EligibilityDetails: React.FC<EligibilityDetailsProps> = ({hieClientEligibility})=>{
   return <>
   <div className={styles.clientEligibilityDetailsLayout}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Patient Eligibilty Details</h4>
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.clientDetails}>
                <div>
                  <div className={styles.detailData}>
                    <strong className={styles.detailText}>Full Name</strong>
                    <span>{hieClientEligibility.fullName}</span>
                  </div>
                  <div className={styles.detailData}>
                    <strong className={styles.detailText}>CR No</strong>
                    <span>{hieClientEligibility.memberCrNumber}</span>
                  </div>
                  <div className={styles.detailData}>
                    <strong className={styles.detailText}>Status</strong>
                    <span>{hieClientEligibility.statusDesc}</span>
                  </div>
                </div>
              </div>
              <div className={styles.schemeSection}>
                <div className={styles.sectionHeader}>
                  <h4 className={styles.sectionTitle}>Scheme Details</h4>
                </div>
                <div className={styles.schemeTable}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>No</TableHeader>
                        <TableHeader>Name</TableHeader>
                        <TableHeader>Member Type</TableHeader>
                        <TableHeader>Policy</TableHeader>
                        <TableHeader>Coverage</TableHeader>
                        <TableHeader>Coverage Period</TableHeader>
                        <TableHeader>Coverage Status</TableHeader>
                        <TableHeader>Coverage Reason</TableHeader>
                        <TableHeader>Principal Contributor</TableHeader>
                        <TableHeader>Principal Contributor Employment Type</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {hieClientEligibility.schemes.map((scheme, id) => {
                        return (
                          <TableRow key={id}>
                            <TableCell>{id + 1}</TableCell>
                            <TableCell>{scheme.schemeName}</TableCell>
                            <TableCell>{scheme.memberType}</TableCell>
                            <TableCell>
                              {scheme.policy ? (
                                <>
                                  {scheme.policy.number} ({scheme.policy.startDate} - {scheme.policy.endDate})
                                </>
                              ) : (
                                <></>
                              )}
                            </TableCell>
                            <TableCell>
                              <Tag
                                className="some-class"
                                size="lg"
                                title="Status"
                                type={getTagType(scheme.coverage.status)}
                              >
                                {scheme.coverage.status === '1' ? 'Active' : 'Not Active'}
                              </Tag>
                            </TableCell>
                            <TableCell>
                              {scheme.coverage.startDate} - {scheme.coverage.endDate}
                            </TableCell>
                            <TableCell>{scheme.coverage.message}</TableCell>
                            <TableCell>{scheme.coverage.reason}</TableCell>
                            <TableCell>
                              {scheme.principalContributor.crNumber}
                            </TableCell>
                            <TableCell>{scheme.principalContributor.employmentType}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
   </>
}

export default EligibilityDetails;