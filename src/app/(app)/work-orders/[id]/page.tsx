"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { WorkOrderStatus, ExecutionMode, OrderType, TaskStatus } from "@prisma/client";
import "./work-order-detail.css";

interface TaskInstance {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  sequenceNumber: number | null;
  isCritical: boolean;
  requiresEvidence: boolean;
  assignedTo: {
    name: string | null;
  } | null;
}

interface WorkOrder {
  id: string;
  workOrderNumber: string | null;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  executionMode: ExecutionMode;
  orderType: OrderType;
  createdAt: string;
  customer: {
    id: string;
    name: string;
  } | null;
  site: {
    id: string;
    name: string;
  } | null;
  asset: {
    id: string;
    assetNumber: string;
    description: string | null;
  } | null;
  quote: {
    id: string;
    quoteNumber: string;
  } | null;
  tasks?: TaskInstance[];
}

export default function WorkOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const workOrderId = params?.id;

  useEffect(() => {
    if (workOrderId) {
      fetchWorkOrder();
    }
  }, [workOrderId]);

  const fetchWorkOrder = async () => {
    if (!workOrderId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}`);
      if (response.ok) {
        const result = await response.json();
        setWorkOrder(result.data);
      } else {
        console.error("Failed to fetch work order");
      }
    } catch (error) {
      console.error("Error fetching work order:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: WorkOrderStatus) => {
    if (!workOrder) return;
    
    if (!confirm(`Change work order status to ${newStatus}?`)) return;

    try {
      const response = await fetch(`/api/work-orders/${workOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchWorkOrder();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("An error occurred while updating status");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusClass = (status: WorkOrderStatus) => {
    return status.toLowerCase().replace("_", "-");
  };

  const getOrderTypeDisplay = (type: OrderType) => {
    switch (type) {
      case OrderType.WORK_ORDER:
        return "Work Order";
      case OrderType.SALES_ORDER:
        return "Sales Order";
      case OrderType.PROJECT:
        return "Project";
      default:
        return type;
    }
  };

  const getOrderTypeClass = (type: OrderType) => {
    return type.toLowerCase().replace("_", "-");
  };

  const getExecutionModeDisplay = (mode: ExecutionMode) => {
    return mode === ExecutionMode.UNIFIED ? "Unified" : "Multi-Lane";
  };

  const getExecutionModeClass = (mode: ExecutionMode) => {
    return mode.toLowerCase().replace("_", "-");
  };

  const getTaskStatusClass = (status: TaskStatus) => {
    return status.toLowerCase().replace("_", "-");
  };

  if (loading) {
    return (
      <div className="wo-detail-container">
        <div className="loading-state">
          <div className="loading-spinner-large"></div>
          <div className="loading-text">Loading work order...</div>
        </div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="wo-detail-container">
        <div className="loading-state">
          <div className="loading-text">Work order not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="wo-detail-container">
      {/* Header */}
      <div className="wo-detail-header">
        <button
          onClick={() => router.push("/work-orders")}
          className="back-link"
        >
          ← Back to Work Orders
        </button>
        
        <div className="wo-header-content">
          <div className="wo-header-left">
            <div className="wo-number-badge">
              {workOrder.workOrderNumber || `WO-${workOrder.id.slice(0, 8)}`}
            </div>
            <div className="wo-title">{workOrder.title}</div>
            
            <div className="wo-badges-row">
              <span className={`wo-type-badge ${getOrderTypeClass(workOrder.orderType)}`}>
                {getOrderTypeDisplay(workOrder.orderType)}
              </span>
              <span className={`wo-exec-mode-badge ${getExecutionModeClass(workOrder.executionMode)}`}>
                {getExecutionModeDisplay(workOrder.executionMode)}
              </span>
            </div>

            <div className="wo-metadata">
              <div className="wo-meta-item">
                <span className="wo-meta-icon">📅</span>
                <span>Created <span className="wo-meta-value">{new Date(workOrder.createdAt).toLocaleDateString()}</span></span>
              </div>
              {workOrder.quote && (
                <div className="wo-meta-item">
                  <span className="wo-meta-icon">📋</span>
                  <span>From Quote <span className="wo-meta-value">{workOrder.quote.quoteNumber}</span></span>
                </div>
              )}
            </div>
          </div>
          
          <div className={`wo-status-badge-large ${getStatusClass(workOrder.status)}`}>
            {workOrder.status.replace("_", " ")}
          </div>
        </div>
      </div>

      {/* Customer & Site Information */}
      <div className="wo-section">
        <h2 className="wo-section-title">
          <span className="section-icon">🏢</span>
          Location Information
        </h2>
        <div className="customer-grid">
          <div className="info-block">
            <div className="info-label">Customer</div>
            <div className="info-value">{workOrder.customer?.name || "No customer assigned"}</div>
          </div>

          <div className="info-block">
            <div className="info-label">Site</div>
            <div className="info-value">{workOrder.site?.name || "No site assigned"}</div>
          </div>

          {workOrder.asset && (
            <div className="info-block">
              <div className="info-label">Asset</div>
              <div className="info-value">
                {workOrder.asset.assetNumber}
                {workOrder.asset.description && (
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                    {workOrder.asset.description}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {workOrder.description && (
        <div className="wo-section">
          <h2 className="wo-section-title">
            <span className="section-icon">📝</span>
            Description
          </h2>
          <div className="wo-description-block">
            <div className="wo-description-text">{workOrder.description}</div>
          </div>
        </div>
      )}

      {/* Tasks */}
      <div className="wo-section">
        <h2 className="wo-section-title">
          <span className="section-icon">✓</span>
          Tasks {(workOrder.tasks?.length ?? 0) > 0 && `(${workOrder.tasks?.length})`}
        </h2>
        {!workOrder.tasks || workOrder.tasks.length === 0 ? (
          <div className="task-empty-state">
            <div className="task-empty-icon">📋</div>
            <div>No tasks assigned to this work order yet</div>
          </div>
        ) : (
          <div className="tasks-list">
            {[...workOrder.tasks]
              .sort((a, b) => (a.sequenceNumber || 999) - (b.sequenceNumber || 999))
              .map((task) => (
                <div key={task.id} className="task-item">
                  <input
                    type="checkbox"
                    className="task-checkbox"
                    checked={task.status === TaskStatus.DONE}
                    readOnly
                  />
                  <div className="task-content">
                    <div className="task-header">
                      <div className="task-title">
                        {task.sequenceNumber && `${task.sequenceNumber}. `}
                        {task.title}
                        {task.isCritical && " ⚠️"}
                      </div>
                      <span className={`task-status-badge ${getTaskStatusClass(task.status)}`}>
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                    {task.description && (
                      <div className="task-description">{task.description}</div>
                    )}
                    {task.assignedTo && (
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                        👤 Assigned to: {task.assignedTo.name}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="actions-section no-print">
        <h3 className="actions-title">
          <span className="section-icon">⚡</span>
          Actions
        </h3>
        <div className="actions-grid">
          <button
            onClick={handlePrint}
            className="action-button primary"
          >
            <span>🖨️</span> Print Work Order
          </button>

          {workOrder.status === WorkOrderStatus.OPEN && (
            <button
              onClick={() => handleStatusChange(WorkOrderStatus.IN_PROGRESS)}
              className="action-button primary"
            >
              <span>▶️</span> Start Work Order
            </button>
          )}

          {workOrder.status === WorkOrderStatus.IN_PROGRESS && (
            <button
              onClick={() => handleStatusChange(WorkOrderStatus.COMPLETED)}
              className="action-button success"
            >
              <span>✓</span> Mark Complete
            </button>
          )}

          {workOrder.status !== WorkOrderStatus.CANCELED && workOrder.status !== WorkOrderStatus.COMPLETED && (
            <button
              onClick={() => handleStatusChange(WorkOrderStatus.CANCELED)}
              className="action-button secondary"
            >
              <span>🚫</span> Cancel Work Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
