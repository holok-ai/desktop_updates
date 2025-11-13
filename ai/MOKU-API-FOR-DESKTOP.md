## Moku API Backend Implementation
version 1.0 

This section describes the backend implementation needed in the Moku API (Java/Spring Boot) to support the thread and project management features required by the desktop application.

### Architecture Overview

```
Desktop App (Electron)
    ↓
Desktop MokuService (HTTP Client)
    ↓
Moku API (Spring Boot)
    ↓
DesktopThreadController → DesktopThreadService → DesktopThreadRepository
                                               → DesktopMessageRepository
DesktopProjectController → DesktopProjectService → ProjectRepository
```

### Layer Responsibilities

1. **Controller Layer** - HTTP endpoint handling, request validation, response formatting
2. **Service Layer** - Business logic, authorization, transaction management
3. **Repository Layer** - Database operations, entity management
4. **DTO Layer** - Data transfer objects for API requests/responses

---

## Implementation Summary

### Controller Endpoints to Implement

#### DesktopThreadController (`/api/threads`)

1. **GET /api/threads** - List all threads for current user
2. **GET /api/threads/{threadId}** - Get single thread by ID
3. **GET /api/threads/{threadId}/messages** - Get all messages for a thread
4. **POST /api/threads** - Create a new thread
5. **PATCH /api/threads/{threadId}** - Update thread metadata
6. **POST /api/threads/{threadId}/messages** - Append message to thread
7. **POST /api/threads/{threadId}/move** - Move thread to/from project
8. **POST /api/threads/{threadId}/soft-delete** - Soft delete thread
9. **DELETE /api/threads/{threadId}** - Permanently delete thread

#### DesktopProjectController (`/api/projects`)

1. **GET /api/projects** - List all projects for current user
2. **GET /api/projects/{projectId}/threads** - Get thread count for a project

---

### Service Methods Required

#### DesktopThreadService

- **listThreadsForUser(Authentication)** - Retrieve all non-deleted threads for authenticated user
- **getThreadById(UUID, Authentication)** - Fetch single thread with authorization check
- **getMessagesForThread(UUID, Authentication)** - Get all messages ordered chronologically
- **createThread(CreateThreadRequestDTO, Authentication)** - Create new thread with defaults
- **updateThread(UUID, UpdateThreadRequestDTO, Authentication)** - Update thread with metadata merging
- **appendMessage(UUID, AppendMessageRequestDTO, Authentication)** - Add message with idempotency and size validation
- **moveThreadToProject(UUID, MoveThreadRequestDTO, Authentication)** - Associate thread with project
- **softDeleteThread(UUID, Authentication)** - Mark thread as deleted without removing data
- **deleteThread(UUID, Authentication)** - Permanently remove thread and messages
- **toThreadSummaryDTO(DesktopThread)** - Convert entity to summary DTO
- **toThreadDetailDTO(DesktopThread)** - Convert entity to detailed DTO with messages
- **toMessageDTO(DesktopMessage)** - Convert message entity to DTO

#### DesktopProjectService

- **listProjectsForUser(Authentication)** - Retrieve all accessible projects
- **getThreadCountForProject(UUID, Authentication)** - Count threads in project

---

### Repository Methods Required

#### DesktopThreadRepository

- **findByUserIdAndDeletedAtIsNull(UUID)** - Query non-deleted threads for user
- **findByUserId(UUID)** - Query all threads for user

#### DesktopMessageRepository

- **findByThreadIdAndDeletedAtIsNullOrderByCreatedAtAsc(UUID)** - Query messages sorted by time
- **findByThreadIdAndClientMessageId(UUID, String)** - Find message for idempotency check
- **deleteByThreadId(UUID)** - Remove all thread messages

---

### DTO Classes Required

#### Response DTOs (`ai.holok.moku.dto.desktop`)

- **ThreadSummaryDTO** - Basic thread info without messages
- **ThreadDetailDTO** - Complete thread with messages array
- **MessageDTO** - Single message representation
- **AppendMessageResponseDTO** - Contains created message and updated thread
- **ProjectSummaryDTO** - Project information
- **ProjectThreadCountDTO** - Project with thread count

#### Request DTOs (`ai.holok.moku.dto.desktop`)

- **CreateThreadRequestDTO** - Thread creation payload with validation
- **UpdateThreadRequestDTO** - Partial thread updates
- **AppendMessageRequestDTO** - Message creation with role validation
- **MoveThreadRequestDTO** - Project association payload

---

### Entity Models Required

- **DesktopThread** - Maps to `desktop_threads` table
- **DesktopMessage** - Maps to `desktop_messages` table

---

### Database Tables Required

- **desktop_threads** - Thread storage with user_id, status, JSONB metadata
- **desktop_messages** - Message storage with thread_id, role, content

**Indexes:**
- `idx_desktop_threads_user_id` on `desktop_threads(user_id)`
- `idx_desktop_messages_thread_id` on `desktop_messages(thread_id)`

---

### Controller Layer

#### DesktopThreadController

Handles all thread-related HTTP endpoints for the desktop application.

```java
package ai.holok.moku.controller;

import ai.holok.moku.dto.desktop.*;
import ai.holok.moku.service.DesktopThreadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/threads")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Desktop Threads", description = "Thread management endpoints for desktop application")
@PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
public class DesktopThreadController {

    private final DesktopThreadService threadService;

    @GetMapping
    @Operation(summary = "List all threads for current user")
    public ResponseEntity<List<ThreadSummaryDTO>> listThreads(Authentication authentication) {
        log.info("List threads request from user: {}", authentication.getName());
        List<ThreadSummaryDTO> threads = threadService.listThreadsForUser(authentication);
        return ResponseEntity.ok(threads);
    }

    @GetMapping("/{threadId}")
    @Operation(summary = "Get single thread by ID")
    public ResponseEntity<ThreadDetailDTO> getThread(
            @PathVariable UUID threadId,
            Authentication authentication) {
        log.info("Get thread request: threadId={}, user={}", threadId, authentication.getName());
        ThreadDetailDTO thread = threadService.getThreadById(threadId, authentication);
        return ResponseEntity.ok(thread);
    }

    @GetMapping("/{threadId}/messages")
    @Operation(summary = "Get all messages for a thread")
    public ResponseEntity<List<MessageDTO>> getThreadMessages(
            @PathVariable UUID threadId,
            Authentication authentication) {
        log.info("Get messages request: threadId={}, user={}", threadId, authentication.getName());
        List<MessageDTO> messages = threadService.getMessagesForThread(threadId, authentication);
        return ResponseEntity.ok(messages);
    }

    @PostMapping
    @Operation(summary = "Create a new thread")
    public ResponseEntity<ThreadDetailDTO> createThread(
            @Valid @RequestBody CreateThreadRequestDTO request,
            Authentication authentication) {
        log.info("Create thread request from user: {}", authentication.getName());
        ThreadDetailDTO thread = threadService.createThread(request, authentication);
        return ResponseEntity.status(HttpStatus.CREATED).body(thread);
    }

    @PatchMapping("/{threadId}")
    @Operation(summary = "Update thread metadata")
    public ResponseEntity<ThreadDetailDTO> updateThread(
            @PathVariable UUID threadId,
            @Valid @RequestBody UpdateThreadRequestDTO request,
            Authentication authentication) {
        log.info("Update thread request: threadId={}, user={}", threadId, authentication.getName());
        ThreadDetailDTO thread = threadService.updateThread(threadId, request, authentication);
        return ResponseEntity.ok(thread);
    }

    @PostMapping("/{threadId}/messages")
    @Operation(summary = "Append message to thread")
    public ResponseEntity<AppendMessageResponseDTO> appendMessage(
            @PathVariable UUID threadId,
            @Valid @RequestBody AppendMessageRequestDTO request,
            Authentication authentication) {
        log.info("Append message request: threadId={}, user={}", threadId, authentication.getName());
        AppendMessageResponseDTO response = threadService.appendMessage(threadId, request, authentication);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{threadId}/move")
    @Operation(summary = "Move thread to/from project")
    public ResponseEntity<ThreadDetailDTO> moveThreadToProject(
            @PathVariable UUID threadId,
            @Valid @RequestBody MoveThreadRequestDTO request,
            Authentication authentication) {
        log.info("Move thread request: threadId={}, targetProjectId={}, user={}",
                threadId, request.getTargetProjectId(), authentication.getName());
        ThreadDetailDTO thread = threadService.moveThreadToProject(threadId, request, authentication);
        return ResponseEntity.ok(thread);
    }

    @PostMapping("/{threadId}/soft-delete")
    @Operation(summary = "Soft delete thread")
    public ResponseEntity<Void> softDeleteThread(
            @PathVariable UUID threadId,
            Authentication authentication) {
        log.info("Soft delete thread request: threadId={}, user={}", threadId, authentication.getName());
        threadService.softDeleteThread(threadId, authentication);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{threadId}")
    @Operation(summary = "Permanently delete thread")
    public ResponseEntity<Void> deleteThread(
            @PathVariable UUID threadId,
            Authentication authentication) {
        log.info("Delete thread request: threadId={}, user={}", threadId, authentication.getName());
        threadService.deleteThread(threadId, authentication);
        return ResponseEntity.ok().build();
    }
}
```

#### DesktopProjectController

Handles project-related HTTP endpoints (if needed for thread organization).

```java
package ai.holok.moku.controller;

import ai.holok.moku.dto.desktop.*;
import ai.holok.moku.service.DesktopProjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Desktop Projects", description = "Project management endpoints for desktop application")
@PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
public class DesktopProjectController {

    private final DesktopProjectService projectService;

    @GetMapping
    @Operation(summary = "List all projects for current user")
    public ResponseEntity<List<ProjectSummaryDTO>> listProjects(Authentication authentication) {
        List<ProjectSummaryDTO> projects = projectService.listProjectsForUser(authentication);
        return ResponseEntity.ok(projects);
    }

    @GetMapping("/{projectId}/threads")
    @Operation(summary = "Get thread count for a project")
    public ResponseEntity<ProjectThreadCountDTO> getProjectThreadCount(
            @PathVariable UUID projectId,
            Authentication authentication) {
        ProjectThreadCountDTO count = projectService.getThreadCountForProject(projectId, authentication);
        return ResponseEntity.ok(count);
    }
}
```

---

### Service Layer

#### DesktopThreadService

Business logic for thread operations with authorization checks.

```java
package ai.holok.moku.service;

import ai.holok.moku.dto.desktop.*;
import ai.holok.moku.model.DesktopThread;
import ai.holok.moku.model.DesktopMessage;
import ai.holok.moku.model.User;
import ai.holok.moku.repository.DesktopThreadRepository;
import ai.holok.moku.repository.DesktopMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityNotFoundException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DesktopThreadService {

    private final DesktopThreadRepository threadRepository;
    private final DesktopMessageRepository messageRepository;
    private final UserService userService;

    @Transactional(readOnly = true)
    public List<ThreadSummaryDTO> listThreadsForUser(Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        List<DesktopThread> threads = threadRepository.findByUserIdAndDeletedAtIsNull(user.getId());

        return threads.stream()
                .map(this::toThreadSummaryDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ThreadDetailDTO getThreadById(UUID threadId, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new EntityNotFoundException("Thread not found: " + threadId));

        // Authorization check
        if (!thread.getUserId().equals(user.getId())) {
            throw new SecurityException("Access denied to thread: " + threadId);
        }

        return toThreadDetailDTO(thread);
    }

    @Transactional(readOnly = true)
    public List<MessageDTO> getMessagesForThread(UUID threadId, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new EntityNotFoundException("Thread not found: " + threadId));

        // Authorization check
        if (!thread.getUserId().equals(user.getId())) {
            throw new SecurityException("Access denied to thread: " + threadId);
        }

        List<DesktopMessage> messages = messageRepository.findByThreadIdAndDeletedAtIsNullOrderByCreatedAtAsc(threadId);

        return messages.stream()
                .map(this::toMessageDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public ThreadDetailDTO createThread(CreateThreadRequestDTO request, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = new DesktopThread();
        thread.setId(UUID.randomUUID());
        thread.setUserId(user.getId());
        thread.setTitle(request.getTitle() != null ? request.getTitle() : "");
        thread.setDescription(request.getDescription());
        thread.setStatus("active");
        thread.setMetadata(request.getMetadata());
        thread.setCreatedAt(Instant.now());
        thread.setUpdatedAt(Instant.now());

        thread = threadRepository.save(thread);
        log.info("Created thread: threadId={}, userId={}", thread.getId(), user.getId());

        return toThreadDetailDTO(thread);
    }

    @Transactional
    public ThreadDetailDTO updateThread(UUID threadId, UpdateThreadRequestDTO request, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new EntityNotFoundException("Thread not found: " + threadId));

        // Authorization check
        if (!thread.getUserId().equals(user.getId())) {
            throw new SecurityException("Access denied to thread: " + threadId);
        }

        // Update fields
        if (request.getTitle() != null) {
            thread.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            thread.setDescription(request.getDescription());
        }
        if (request.getStatus() != null) {
            thread.setStatus(request.getStatus());
        }
        if (request.getMetadata() != null) {
            // Merge metadata
            Map<String, Object> metadata = thread.getMetadata();
            if (metadata == null) {
                metadata = request.getMetadata();
            } else {
                metadata.putAll(request.getMetadata());
            }
            thread.setMetadata(metadata);
        }
        thread.setUpdatedAt(Instant.now());

        thread = threadRepository.save(thread);
        log.info("Updated thread: threadId={}", threadId);

        return toThreadDetailDTO(thread);
    }

    @Transactional
    public AppendMessageResponseDTO appendMessage(UUID threadId, AppendMessageRequestDTO request, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new EntityNotFoundException("Thread not found: " + threadId));

        // Authorization check
        if (!thread.getUserId().equals(user.getId())) {
            throw new SecurityException("Access denied to thread: " + threadId);
        }

        // Check for idempotency
        if (request.getClientMessageId() != null) {
            DesktopMessage existing = messageRepository.findByThreadIdAndClientMessageId(
                    threadId, request.getClientMessageId());
            if (existing != null) {
                log.info("Idempotent message request: returning existing message={}", existing.getId());
                return new AppendMessageResponseDTO(toMessageDTO(existing), toThreadSummaryDTO(thread));
            }
        }

        // Validate message size (8KB limit)
        if (request.getContent().getBytes().length > 8 * 1024) {
            throw new IllegalArgumentException("MESSAGE_TOO_LARGE");
        }

        // Create message
        DesktopMessage message = new DesktopMessage();
        message.setId(UUID.randomUUID());
        message.setThreadId(threadId);
        message.setRole(request.getRole());
        message.setContent(request.getContent());
        message.setMetadata(request.getMetadata());
        message.setClientMessageId(request.getClientMessageId());
        message.setCreatedAt(Instant.now());

        message = messageRepository.save(message);

        // Update thread timestamp
        thread.setUpdatedAt(Instant.now());
        thread = threadRepository.save(thread);

        log.info("Appended message: messageId={}, threadId={}, role={}",
                message.getId(), threadId, request.getRole());

        return new AppendMessageResponseDTO(toMessageDTO(message), toThreadSummaryDTO(thread));
    }

    @Transactional
    public ThreadDetailDTO moveThreadToProject(UUID threadId, MoveThreadRequestDTO request, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new EntityNotFoundException("Thread not found: " + threadId));

        // Authorization check
        if (!thread.getUserId().equals(user.getId())) {
            throw new SecurityException("Access denied to thread: " + threadId);
        }

        // Update metadata with project ID
        Map<String, Object> metadata = thread.getMetadata();
        if (request.getTargetProjectId() == null) {
            metadata.remove("projectId");
        } else {
            metadata.put("projectId", request.getTargetProjectId().toString());
        }

        if (request.getPrivacyMode() != null) {
            metadata.put("privacyMode", request.getPrivacyMode());
        }
        if (request.getContextHandling() != null) {
            metadata.put("contextHandling", request.getContextHandling());
        }

        thread.setMetadata(metadata);
        thread.setUpdatedAt(Instant.now());
        thread = threadRepository.save(thread);

        log.info("Moved thread: threadId={}, projectId={}", threadId, request.getTargetProjectId());

        return toThreadDetailDTO(thread);
    }

    @Transactional
    public void softDeleteThread(UUID threadId, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new EntityNotFoundException("Thread not found: " + threadId));

        // Authorization check
        if (!thread.getUserId().equals(user.getId())) {
            throw new SecurityException("Access denied to thread: " + threadId);
        }

        thread.setDeletedAt(Instant.now());
        thread.setStatus("deleted");
        thread.setUpdatedAt(Instant.now());
        threadRepository.save(thread);

        log.info("Soft deleted thread: threadId={}", threadId);
    }

    @Transactional
    public void deleteThread(UUID threadId, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new EntityNotFoundException("Thread not found: " + threadId));

        // Authorization check
        if (!thread.getUserId().equals(user.getId())) {
            throw new SecurityException("Access denied to thread: " + threadId);
        }

        // Delete all messages first
        messageRepository.deleteByThreadId(threadId);

        // Delete thread
        threadRepository.delete(thread);

        log.info("Permanently deleted thread: threadId={}", threadId);
    }

    // DTO conversion methods
    private ThreadSummaryDTO toThreadSummaryDTO(DesktopThread thread) {
        return ThreadSummaryDTO.builder()
                .id(thread.getId())
                .title(thread.getTitle())
                .description(thread.getDescription())
                .status(thread.getStatus())
                .createdAt(thread.getCreatedAt().toEpochMilli())
                .updatedAt(thread.getUpdatedAt().toEpochMilli())
                .metadata(thread.getMetadata())
                .build();
    }

    private ThreadDetailDTO toThreadDetailDTO(DesktopThread thread) {
        List<DesktopMessage> messages = messageRepository.findByThreadIdAndDeletedAtIsNullOrderByCreatedAtAsc(thread.getId());

        return ThreadDetailDTO.builder()
                .id(thread.getId())
                .title(thread.getTitle())
                .description(thread.getDescription())
                .status(thread.getStatus())
                .createdAt(thread.getCreatedAt().toEpochMilli())
                .updatedAt(thread.getUpdatedAt().toEpochMilli())
                .deletedAt(thread.getDeletedAt() != null ? thread.getDeletedAt().toEpochMilli() : null)
                .metadata(thread.getMetadata())
                .messages(messages.stream().map(this::toMessageDTO).collect(Collectors.toList()))
                .build();
    }

    private MessageDTO toMessageDTO(DesktopMessage message) {
        return MessageDTO.builder()
                .id(message.getId())
                .threadId(message.getThreadId())
                .role(message.getRole())
                .content(message.getContent())
                .createdAt(message.getCreatedAt().toEpochMilli())
                .metadata(message.getMetadata())
                .clientMessageId(message.getClientMessageId())
                .deletedAt(message.getDeletedAt() != null ? message.getDeletedAt().toEpochMilli() : null)
                .build();
    }
}
```

---

### Repository Layer

```java
package ai.holok.moku.repository;

import ai.holok.moku.model.DesktopThread;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DesktopThreadRepository extends JpaRepository<DesktopThread, UUID> {

    List<DesktopThread> findByUserIdAndDeletedAtIsNull(UUID userId);

    List<DesktopThread> findByUserId(UUID userId);
}
```

```java
package ai.holok.moku.repository;

import ai.holok.moku.model.DesktopMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DesktopMessageRepository extends JpaRepository<DesktopMessage, UUID> {

    List<DesktopMessage> findByThreadIdAndDeletedAtIsNullOrderByCreatedAtAsc(UUID threadId);

    DesktopMessage findByThreadIdAndClientMessageId(UUID threadId, String clientMessageId);

    void deleteByThreadId(UUID threadId);
}
```

---

### Entity Models

```java
package ai.holok.moku.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "desktop_threads")
@Data
public class DesktopThread {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private String status; // active, archived, deleted

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
```

```java
package ai.holok.moku.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "desktop_messages")
@Data
public class DesktopMessage {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "thread_id", nullable = false, columnDefinition = "uuid")
    private UUID threadId;

    @Column(nullable = false)
    private String role; // user, assistant, system

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Column(name = "client_message_id")
    private String clientMessageId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
```

---

### DTO Classes

```java
package ai.holok.moku.dto.desktop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ThreadSummaryDTO {
    private UUID id;
    private String title;
    private String description;
    private String status;
    private Long createdAt;  // epoch milliseconds
    private Long updatedAt;  // epoch milliseconds
    private Map<String, Object> metadata;
}
```

```java
package ai.holok.moku.dto.desktop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ThreadDetailDTO {
    private UUID id;
    private String title;
    private String description;
    private String status;
    private Long createdAt;
    private Long updatedAt;
    private Long deletedAt;
    private Map<String, Object> metadata;
    private List<MessageDTO> messages;
}
```

```java
package ai.holok.moku.dto.desktop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageDTO {
    private UUID id;
    private UUID threadId;
    private String role;
    private String content;
    private Long createdAt;
    private Map<String, Object> metadata;
    private String clientMessageId;
    private Long deletedAt;
}
```

```java
package ai.holok.moku.dto.desktop;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Map;

@Data
public class CreateThreadRequestDTO {
    @Size(max = 255)
    private String title;

    @Size(max = 1000)
    private String description;

    private Map<String, Object> metadata;
}
```

```java
package ai.holok.moku.dto.desktop;

import lombok.Data;

import java.util.Map;

@Data
public class UpdateThreadRequestDTO {
    private String title;
    private String description;
    private String status;
    private Map<String, Object> metadata;
}
```

```java
package ai.holok.moku.dto.desktop;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.util.Map;

@Data
public class AppendMessageRequestDTO {
    @NotBlank
    @Pattern(regexp = "user|assistant|system")
    private String role;

    @NotBlank
    private String content;

    private Map<String, Object> metadata;

    private String clientMessageId;
}
```

```java
package ai.holok.moku.dto.desktop;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AppendMessageResponseDTO {
    private MessageDTO message;
    private ThreadSummaryDTO thread;
}
```

```java
package ai.holok.moku.dto.desktop;

import lombok.Data;

import java.util.UUID;

@Data
public class MoveThreadRequestDTO {
    private UUID targetProjectId;
    private String privacyMode;
    private String contextHandling;
}
```

---

### Database Schema

#### Database Migration (Flyway)

The database schema should be created using Flyway migrations for version control and reproducibility.

**File**: `src/main/resources/db/migration/V{VERSION}__create_desktop_threads_tables.sql`

Replace `{VERSION}` with the appropriate version number (e.g., `V1.15` if the last migration was `V1.14`).

```sql
-- ============================================================================
-- Desktop Threads and Messages Tables
-- ============================================================================
-- Description: Creates tables for desktop application thread management
-- Author: [Your Name]
-- Date: [Current Date]
-- Version: V{VERSION}
-- ============================================================================

-- Desktop Threads Table
-- Stores conversation threads for desktop application users
CREATE TABLE desktop_threads (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,

    CONSTRAINT desktop_threads_status_check CHECK (status IN ('active', 'archived', 'deleted')),
    CONSTRAINT fk_desktop_threads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for desktop_threads
CREATE INDEX idx_desktop_threads_user_id ON desktop_threads(user_id);

-- Comment on table
COMMENT ON TABLE desktop_threads IS 'Conversation threads for desktop application';
COMMENT ON COLUMN desktop_threads.id IS 'Unique thread identifier';
COMMENT ON COLUMN desktop_threads.user_id IS 'User who owns this thread';
COMMENT ON COLUMN desktop_threads.title IS 'Thread title/name';
COMMENT ON COLUMN desktop_threads.description IS 'Optional thread description';
COMMENT ON COLUMN desktop_threads.status IS 'Thread status: active, archived, or deleted';
COMMENT ON COLUMN desktop_threads.metadata IS 'Flexible metadata storage (model, projectId, etc.)';
COMMENT ON COLUMN desktop_threads.created_at IS 'Timestamp when thread was created';
COMMENT ON COLUMN desktop_threads.updated_at IS 'Timestamp of last update';
COMMENT ON COLUMN desktop_threads.deleted_at IS 'Soft delete timestamp (NULL if not deleted)';

-- Desktop Messages Table
-- Stores individual messages within threads
CREATE TABLE desktop_messages (
    id UUID PRIMARY KEY,
    thread_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    client_message_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,

    CONSTRAINT desktop_messages_role_check CHECK (role IN ('user', 'assistant', 'system')),
    CONSTRAINT fk_desktop_messages_thread FOREIGN KEY (thread_id) REFERENCES desktop_threads(id) ON DELETE CASCADE
);

-- Indexes for desktop_messages
CREATE INDEX idx_desktop_messages_thread_id ON desktop_messages(thread_id);

-- Comment on table
COMMENT ON TABLE desktop_messages IS 'Messages within desktop application threads';
COMMENT ON COLUMN desktop_messages.id IS 'Unique message identifier';
COMMENT ON COLUMN desktop_messages.thread_id IS 'Thread this message belongs to';
COMMENT ON COLUMN desktop_messages.role IS 'Message role: user, assistant, or system';
COMMENT ON COLUMN desktop_messages.content IS 'Message content/text';
COMMENT ON COLUMN desktop_messages.metadata IS 'Flexible metadata storage (model, provider, attachments, etc.)';
COMMENT ON COLUMN desktop_messages.client_message_id IS 'Client-provided ID for idempotency';
COMMENT ON COLUMN desktop_messages.created_at IS 'Timestamp when message was created';
COMMENT ON COLUMN desktop_messages.deleted_at IS 'Soft delete timestamp (NULL if not deleted)';

-- ============================================================================
-- End of migration
-- ============================================================================
```

#### Flyway Migration Notes

1. **Version Numbering**: Follow your project's versioning convention (e.g., `V1.15`, `V2.0`, etc.)
2. **Naming Convention**: `V{VERSION}__{description}.sql` (use double underscore)
3. **Idempotency**: Flyway ensures migrations run only once
4. **Rollback**: Create corresponding `U{VERSION}__rollback_desktop_threads.sql` if needed:

```sql
-- Rollback migration (if needed)
-- File: U{VERSION}__rollback_desktop_threads.sql

DROP TABLE IF EXISTS desktop_messages CASCADE;
DROP TABLE IF EXISTS desktop_threads CASCADE;
```

5. **Testing**: Test migration on local/dev database before production:
```bash
# Validate migration
./gradlew flywayValidate

# Run migration
./gradlew flywayMigrate

# Check migration status
./gradlew flywayInfo
```

6. **Dependencies**: Ensure `users` table exists before running this migration
7. **Baseline**: If adding to existing database, may need to baseline:
```bash
./gradlew flywayBaseline
```

#### Schema Verification Queries

After migration, verify tables were created correctly:

```sql
-- Check tables exist
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('desktop_threads', 'desktop_messages');

-- Check indexes
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE tablename IN ('desktop_threads', 'desktop_messages')
ORDER BY tablename, indexname;

-- Check constraints
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN (
    SELECT oid FROM pg_class
    WHERE relname IN ('desktop_threads', 'desktop_messages')
);

-- Check JSONB column support
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('desktop_threads', 'desktop_messages')
  AND data_type = 'jsonb';
```

---

### Key Design Decisions

1. **Separate Tables**: `desktop_threads` and `desktop_messages` for clean separation
2. **UUID Primary Keys**: For distributed systems and security
3. **JSONB Metadata**: Flexible storage for extensibility without schema changes
4. **Soft Deletes**: `deletedAt` timestamp for recovery and audit trail
5. **Idempotency**: `clientMessageId` index for preventing duplicate messages
6. **Cascade Deletes**: Foreign key constraints ensure data integrity
7. **Authorization**: Service layer checks user ownership on all operations
8. **Transaction Management**: `@Transactional` ensures atomic operations
9. **Epoch Timestamps**: DTOs use epoch milliseconds for JavaScript compatibility
10. **Validation**: Bean validation annotations on request DTOs
