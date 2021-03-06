/**
 * Copyright 2015 StreamSets Inc.
 *
 * Licensed under the Apache Software Foundation (ASF) under one
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
package com.streamsets.datacollector.kafka.cluster;

import com.google.common.io.Resources;
import com.streamsets.datacollector.base.TestPipelineOperationsCluster;
import com.streamsets.pipeline.kafka.common.DataType;
import com.streamsets.pipeline.kafka.common.KafkaTestUtil;
import com.streamsets.pipeline.kafka.common.ProducerRunnable;
import kafka.javaapi.producer.Producer;
import org.junit.AfterClass;
import org.junit.BeforeClass;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class TestKafkaOriginSinglePartition extends TestPipelineOperationsCluster {

  private static final String TOPIC = "TestKafkaOriginSinglePartitionCluster";
  private static CountDownLatch startLatch;
  private static ExecutorService executorService;

  @BeforeClass
  public static void beforeClass() throws Exception {
    KafkaTestUtil.startZookeeper();
    KafkaTestUtil.startKafkaBrokers(1);
    KafkaTestUtil.createTopic(TOPIC, 1, 1);
    startLatch = new CountDownLatch(1);
    Producer<String, String> producer = KafkaTestUtil.createProducer(KafkaTestUtil.getMetadataBrokerURI(), true);
    executorService = Executors.newSingleThreadExecutor();
    executorService.submit(new ProducerRunnable(TOPIC, 1, producer, startLatch, DataType.TEXT, null, -1,
      null));

    TestPipelineOperationsCluster.beforeClass(getPipelineJson(), "TestKafkaOriginSinglePartitionCluster");
    startLatch.countDown();
  }

  @AfterClass
  public static void afterClass() throws Exception {
    executorService.shutdownNow();
    KafkaTestUtil.shutdown();
    TestPipelineOperationsCluster.afterClass("TestKafkaOriginSinglePartitionCluster");
  }

  private static String getPipelineJson() throws Exception {
    URI uri = Resources.getResource("kafka_origin_pipeline.json").toURI();
    String pipelineJson =  new String(Files.readAllBytes(Paths.get(uri)), StandardCharsets.UTF_8);
    pipelineJson = pipelineJson.replace("topicName", TOPIC);
    pipelineJson = pipelineJson.replaceAll("localhost:9092", KafkaTestUtil.getMetadataBrokerURI());
    pipelineJson = pipelineJson.replaceAll("localhost:2181", KafkaTestUtil.getZkConnect());
    pipelineJson = pipelineJson.replaceAll("STANDALONE", "CLUSTER_YARN_STREAMING");
    return pipelineJson;
  }

  @Override
  protected String getPipelineName() {
    return "kafka_origin_pipeline";
  }

  @Override
  protected String getPipelineRev() {
    return "0";
  }

}
