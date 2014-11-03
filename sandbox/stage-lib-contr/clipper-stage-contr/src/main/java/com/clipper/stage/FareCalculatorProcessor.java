/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.clipper.stage;

import com.streamsets.pipeline.api.*;
import com.streamsets.pipeline.api.base.BaseProcessor;

import java.util.Iterator;

public class FareCalculatorProcessor extends BaseProcessor{

  private double totalClaim = 0.0;

  @Override
  public void process(Batch batch, BatchMaker batchMaker) throws StageException {
    Iterator<Record> it = batch.getRecords();
    while (it.hasNext()) {
      Record record = it.next();

      Field f = record.getField("transactionLog");
      String transactionLog = (String)f.getValue();
      double transactionFare = 0.0;

      if(transactionLog.contains("Dual-tag entry transaction, maximum fare deducted")
        || transactionLog.contains("Single-tag fare payment")
        || transactionLog.contains("Dual-tag exit transaction, fare payment")) {
        transactionFare = extractFareFromLine(transactionLog);
      } else if (transactionLog.contains("Dual-tag exit transaction, fare adjustment")) {
        transactionFare = -extractFareFromLine(transactionLog);
      }
      totalClaim += transactionFare;
      record.setField("transactionFare", Field.create(Field.Type.STRING, String.valueOf(transactionFare)));
      record.setField("TotalClaim", Field.create(Field.Type.DOUBLE, totalClaim));
      batchMaker.addRecord(record, "lane");
    }
  }

  private Double extractFareFromLine(String line) {
    //Fare is the last but one word in the line which is empty space separated
    String[] tokens = line.split(" ");
    int length = tokens.length;
    String fare = tokens[length -2];
    try {
      return Double.parseDouble(fare);
    } catch (NumberFormatException e) {
      //Double tagging may result in this. There is an entry but no deduction
      return 0.0;
    }
  }
}
