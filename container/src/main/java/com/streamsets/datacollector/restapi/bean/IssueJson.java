/**
 * (c) 2014 StreamSets, Inc. All rights reserved. May not
 * be copied, modified, or distributed in whole or part without
 * written consent of StreamSets, Inc.
 */
package com.streamsets.datacollector.restapi.bean;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.streamsets.datacollector.validation.Issue;

import java.util.Map;

public class IssueJson {

  private final Issue issue;

  public IssueJson(Issue issue) {
    this.issue = issue;
  }

  public String getInstanceName() {
    return issue.getInstanceName();
  }

  public String getLevel() {
    return issue.getLevel();
  }

  public String getConfigGroup() {
    return issue.getConfigGroup();
  }

  public String getConfigName() {
    return issue.getConfigName();
  }

  public String getMessage() { return issue.getMessage();
  }

  public Map getAdditionalInfo() {
    return issue.getAdditionalInfo();
  }

  @JsonIgnore
  public Issue getIssue() {
    return issue;
  }
}