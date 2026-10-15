/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.config;

import dev.langchain4j.store.embedding.pgvector.PgVectorEmbeddingStore;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

@Configuration
public class WorkspaceRagEmbeddingStoreConfig {

    @Bean
    public PgVectorEmbeddingStore workspaceRagEmbeddingStore(
            DataSource dataSource,
            AiEmbeddingProperties embeddingProperties) {
        return PgVectorEmbeddingStore.datasourceBuilder()
                .datasource(dataSource)
                .table("workspace_ai_rag_embedding")
                .dimension(embeddingProperties.getDimensions())
                .createTable(true)
                .useIndex(false)
                .build();
    }
}